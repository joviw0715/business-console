import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('@/lib/wa-confirmation', () => ({ sendBookingConfirmation: vi.fn() }));

import pool from '@/lib/db';
import axios from 'axios';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';
import { POST } from '@/app/api/webhooks/call-complete/route';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockAxiosPost = axios.post as ReturnType<typeof vi.fn>;
const mockSendWa = sendBookingConfirmation as ReturnType<typeof vi.fn>;

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
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  // Default DB: report insert, contact update, pending count = 1, no campaign done
  mockQuery
    .mockResolvedValueOnce({ rows: [{ id: 99 }] })        // INSERT call_reports
    .mockResolvedValueOnce({ rows: [] })                   // UPDATE contacts
    .mockResolvedValueOnce({ rows: [{ pending: '1' }] }); // pending count check
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
    // Should be 3 queries: insert report, update contact, check pending — NOT 4
    // Campaign update query should not be called
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('marks campaign done when pending contacts = 0', async () => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    mockAxiosPost.mockResolvedValue({ data: { choices: [] } });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })       // INSERT report
      .mockResolvedValueOnce({ rows: [] })                  // UPDATE contacts
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] }) // pending count = 0
      .mockResolvedValueOnce({ rows: [] });                 // UPDATE campaigns SET status = 'done'

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    // The 4th query should be campaign done update
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

  it('calls axios.post (Gemini) when transcript and GEMINI_API_KEY are present', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { choices: [{ message: { content: '{"summary":"ok","sentiment":"positive","outcome":"answered","key_points":[]}' } }] },
    });

    await POST(makeRequest(validBody));
    // Give microtasks a chance to run
    await new Promise(r => setTimeout(r, 10));

    expect(mockAxiosPost).toHaveBeenCalled();
    const callUrl = mockAxiosPost.mock.calls[0][0] as string;
    expect(callUrl).toContain('generativelanguage.googleapis.com');
  });

  it('does not call axios.post when transcript is absent', async () => {
    vi.clearAllMocks();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pending: '1' }] });

    await POST(makeRequest({ ...validBody, transcript: undefined }));
    await new Promise(r => setTimeout(r, 10));

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('does not call axios.post when GEMINI_API_KEY is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    vi.clearAllMocks();
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pending: '1' }] });

    await POST(makeRequest(validBody));
    await new Promise(r => setTimeout(r, 10));

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
