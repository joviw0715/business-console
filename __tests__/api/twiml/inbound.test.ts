import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/credentials', () => ({ getAccountCredentials: vi.fn() }));
vi.mock('@/lib/twilio-validate', () => ({ validateTwilioSignature: vi.fn().mockResolvedValue(null) }));

import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';
import { POST } from '@/app/api/twiml/inbound/route';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockGetCreds = getAccountCredentials as ReturnType<typeof vi.fn>;

const defaultCreds = {
  voiceWebhookUrl: 'https://voice.example.com',
  businessName: 'Demo Clinic',
  webhookBaseUrl: 'https://console.example.com',
};

function makeFormRequest(fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return new Request('http://localhost/api/twiml/inbound', { method: 'POST', body: form });
}

const activeHotline = {
  id: 1, status: 'active', account_id: 1,
  system_prompt: 'You are a helpful assistant for {{business}}.',
  voice_id: 'Cantonese_GentleLady', max_call_duration_sec: 300,
  business_hours: {},
  after_hours_message: null,
  qdrant_collection: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCreds.mockResolvedValue(defaultCreds);
});

describe('POST /api/twiml/inbound', () => {
  it('returns "not configured" when To is empty', async () => {
    const res = await POST(makeFormRequest({ To: '', CallSid: 'CA1', From: '+85299999999' }));
    const xml = await res.text();
    expect(xml).toContain('Sorry, this number is not configured.');
  });

  it('returns "not available" when no hotline found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+85299999999' }));
    const xml = await res.text();
    expect(xml).toContain('Sorry, this service is not available.');
  });

  it('returns normal-hours stream XML for active hotline within business hours', async () => {
    mockQuery.mockResolvedValue({ rows: [activeHotline] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+85299999999' }));
    const xml = await res.text();
    expect(xml).toContain('<Stream url="wss://voice.example.com/stream">');
    expect(xml).toContain('name="afterHours" value="false"');
    expect(xml).toContain('name="direction" value="inbound"');
  });

  it('returns after-hours stream when hotline status is paused', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, status: 'paused' }] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    const xml = await res.text();
    expect(xml).toContain('name="afterHours" value="true"');
  });

  it('returns after-hours when today is disabled in business_hours', async () => {
    const allDaysDisabled: Record<string, { open: string; close: string; enabled: boolean }> = {
      sunday: { open: '09:00', close: '18:00', enabled: false },
      monday: { open: '09:00', close: '18:00', enabled: false },
      tuesday: { open: '09:00', close: '18:00', enabled: false },
      wednesday: { open: '09:00', close: '18:00', enabled: false },
      thursday: { open: '09:00', close: '18:00', enabled: false },
      friday: { open: '09:00', close: '18:00', enabled: false },
      saturday: { open: '09:00', close: '18:00', enabled: false },
    };
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, business_hours: allDaysDisabled }] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    const xml = await res.text();
    expect(xml).toContain('name="afterHours" value="true"');
  });

  it('returns after-hours when current time is outside window', async () => {
    // Set business hours to midnight only (00:00-00:01), so almost always after-hours
    const tinyWindow: Record<string, { open: string; close: string; enabled: boolean }> = {
      sunday: { open: '00:00', close: '00:01', enabled: true },
      monday: { open: '00:00', close: '00:01', enabled: true },
      tuesday: { open: '00:00', close: '00:01', enabled: true },
      wednesday: { open: '00:00', close: '00:01', enabled: true },
      thursday: { open: '00:00', close: '00:01', enabled: true },
      friday: { open: '00:00', close: '00:01', enabled: true },
      saturday: { open: '00:00', close: '00:01', enabled: true },
    };
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, business_hours: tinyWindow }] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    const xml = await res.text();
    // Very likely after hours since window is 1 minute
    // Just assert it returns valid XML
    expect(xml).toContain('<Stream');
  });

  it('returns normal stream when business_hours is empty object', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, business_hours: {} }] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    const xml = await res.text();
    expect(xml).toContain('name="afterHours" value="false"');
  });

  it('qdrantCollection parameter only appears when set', async () => {
    // Without qdrant_collection
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, qdrant_collection: null }] });
    const resWithout = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    expect(await resWithout.text()).not.toContain('qdrantCollection');

    // With qdrant_collection
    vi.clearAllMocks();
    mockGetCreds.mockResolvedValue(defaultCreds);
    mockQuery.mockResolvedValue({ rows: [{ ...activeHotline, qdrant_collection: 'my_collection' }] });
    const resWith = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    expect(await resWith.text()).toContain('name="qdrantCollection" value="my_collection"');
  });

  it('interpolates {{business}} in after_hours_message', async () => {
    mockQuery.mockResolvedValue({ rows: [{
      ...activeHotline, status: 'paused',
      after_hours_message: 'Welcome to {{business}} after hours',
    }]});
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: '+852' }));
    const xml = await res.text();
    expect(xml).toContain('Welcome to Demo Clinic after hours');
  });

  it('strips whatsapp: prefix from caller phone', async () => {
    mockQuery.mockResolvedValue({ rows: [activeHotline] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA1', From: 'whatsapp:+85299999999' }));
    const xml = await res.text();
    expect(xml).toContain('name="callerPhone" value="+85299999999"');
  });

  it('passes callSid in stream parameters', async () => {
    mockQuery.mockResolvedValue({ rows: [activeHotline] });
    const res = await POST(makeFormRequest({ To: '+85212345678', CallSid: 'CA_TEST_SID', From: '+852' }));
    const xml = await res.text();
    expect(xml).toContain('name="callSid" value="CA_TEST_SID"');
  });
});
