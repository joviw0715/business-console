import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/wa-confirmation', () => ({ sendBookingConfirmation: vi.fn() }));
vi.mock('@/lib/credentials', () => ({ getAccountCredentials: vi.fn() }));

import pool from '@/lib/db';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';
import { getAccountCredentials } from '@/lib/credentials';
import { POST } from '@/app/api/webhooks/call-complete/route';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockSendWa = sendBookingConfirmation as ReturnType<typeof vi.fn>;
const mockGetCreds = getAccountCredentials as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/webhooks/call-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  call_sid: 'CA123',
  transcript: 'Hello, this is a test transcript.',
  duration_sec: 30,
  contact_id: 1,
  campaign_id: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no gemini key, so summarise exits early without calling fetch
  mockGetCreds.mockResolvedValue({ geminiApiKey: '', geminiModel: 'gemini-2.5-flash-lite' });
  // Query order when transcript is present:
  //   1. INSERT call_reports
  //   2. UPDATE contacts
  //   3. SELECT account_id (in summarise — fire-and-forget, starts before pending count query)
  //   4. SELECT COUNT pending
  mockQuery
    .mockResolvedValueOnce({ rows: [{ id: 99 }] })          // INSERT call_reports
    .mockResolvedValueOnce({ rows: [] })                     // UPDATE contacts
    .mockResolvedValueOnce({ rows: [{ account_id: 1 }] })   // SELECT account_id (summarise)
    .mockResolvedValueOnce({ rows: [{ active: '1' }] });    // active count check (pending+calling)
});

describe('POST /api/webhooks/call-complete', () => {
  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/call-complete', {
      method: 'POST',
      body: 'not-json',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when WEBHOOK_SECRET is set but Authorization header is missing', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    delete process.env.WEBHOOK_SECRET;
  });

  it('returns 401 when WEBHOOK_SECRET is set but token is wrong', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    const res = await POST(makeRequest(validBody, { Authorization: 'Bearer wrong-token' }));
    expect(res.status).toBe(401);
    delete process.env.WEBHOOK_SECRET;
  });

  it('passes when WEBHOOK_SECRET is set and correct token provided', async () => {
    process.env.WEBHOOK_SECRET = 'test-secret';
    const res = await POST(makeRequest(validBody, { Authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    delete process.env.WEBHOOK_SECRET;
  });

  it('passes when WEBHOOK_SECRET is not set (backward compat)', async () => {
    delete process.env.WEBHOOK_SECRET;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
  });

  it('returns { ok: true, report_id } on success', async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.report_id).toBe(99);
  });

  it('does not mark campaign done when pending count > 0', async () => {
    await POST(makeRequest(validBody));
    // 4 queries: insert report, update contact, select account_id (summarise), check pending
    // Campaign update query should not be called
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it('marks campaign done when pending contacts = 0', async () => {
    vi.clearAllMocks();
    mockGetCreds.mockResolvedValue({ geminiApiKey: '', geminiModel: 'gemini-2.5-flash-lite' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ choices: [] }) }));
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })          // INSERT report
      .mockResolvedValueOnce({ rows: [] })                     // UPDATE contacts
      .mockResolvedValueOnce({ rows: [{ account_id: 1 }] })   // SELECT account_id (summarise)
      .mockResolvedValueOnce({ rows: [{ active: '0' }] })     // active count = 0 (pending+calling)
      .mockResolvedValueOnce({ rows: [] });                    // UPDATE campaigns SET status = 'done'

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    // The done-update query should be present
    const calls = mockQuery.mock.calls;
    const doneCall = calls.find((c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'done'"));
    expect(doneCall).toBeTruthy();
  });

  it('returns 500 when pool.query throws on report insert', async () => {
    vi.resetAllMocks();
    mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it('calls fetch (Gemini) when account has a gemini key configured', async () => {
    vi.clearAllMocks();
    mockGetCreds.mockResolvedValue({ geminiApiKey: 'test-key', geminiModel: 'gemini-2.5-flash-lite' });
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: '{"summary":"ok","sentiment":"positive","outcome":"answered","key_points":[]}' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })          // INSERT call_reports
      .mockResolvedValueOnce({ rows: [] })                     // UPDATE contacts
      .mockResolvedValueOnce({ rows: [{ account_id: 1 }] })   // SELECT account_id (summarise)
      .mockResolvedValueOnce({ rows: [{ active: '1' }] })     // SELECT COUNT pending
      .mockResolvedValue({ rows: [] });                        // summarise DB writes

    await POST(makeRequest(validBody));
    // Give microtasks a chance to run
    await new Promise(r => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalled();
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('generativelanguage.googleapis.com');
  });

  it('does not call fetch (Gemini) when transcript is absent', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
    mockGetCreds.mockResolvedValue({ geminiApiKey: '', geminiModel: 'gemini-2.5-flash-lite' });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pending: '1' }] });

    await POST(makeRequest({ ...validBody, transcript: undefined }));
    await new Promise(r => setTimeout(r, 10));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call fetch (Gemini) when account has no gemini key configured', async () => {
    mockGetCreds.mockResolvedValue({ geminiApiKey: '', geminiModel: 'gemini-2.5-flash-lite' });
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await POST(makeRequest(validBody));
    await new Promise(r => setTimeout(r, 10));

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
