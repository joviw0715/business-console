import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/credentials', () => ({ getAccountCredentials: vi.fn() }));
vi.mock('@/lib/twilio-validate', () => ({ validateTwilioSignature: vi.fn().mockResolvedValue(null) }));

import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';
import { POST } from '@/app/api/twiml/outbound/route';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockGetCreds = getAccountCredentials as ReturnType<typeof vi.fn>;

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/twiml/outbound');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // Send empty form body so formData() doesn't throw
  const form = new FormData();
  return new Request(url.toString(), { method: 'POST', body: form });
}

const defaultCreds = {
  voiceWebhookUrl: 'https://voice.example.com',
  businessName: 'Test Biz',
  webhookBaseUrl: 'https://console.example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCreds.mockResolvedValue(defaultCreds);
  // Default: campaign found, empty config and contact
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM campaigns')) return Promise.resolve({ rows: [{ account_id: 1 }] });
    if (sql.includes('FROM campaign_config')) return Promise.resolve({ rows: [] });
    if (sql.includes('FROM contacts')) return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
});

function setupQueries(config: Record<string, unknown> | null, contact: Record<string, unknown> | null) {
  vi.clearAllMocks();
  mockGetCreds.mockResolvedValue(defaultCreds);
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM campaigns')) return Promise.resolve({ rows: [{ account_id: 1 }] });
    if (sql.includes('FROM campaign_config')) return Promise.resolve({ rows: config ? [config] : [] });
    if (sql.includes('FROM contacts')) return Promise.resolve({ rows: contact ? [contact] : [] });
    return Promise.resolve({ rows: [] });
  });
}

async function getXml(params: Record<string, string> = { contactId: '1', campaignId: '1' }) {
  const res = await POST(makeRequest(params));
  return res.text();
}

describe('POST /api/twiml/outbound', () => {
  it('returns XML with Connect > Stream structure', async () => {
    const xml = await getXml();
    expect(xml).toContain('<Connect>');
    expect(xml).toContain('<Stream url="wss://voice.example.com/stream">');
  });

  it('includes contactId and campaignId as parameters', async () => {
    const xml = await getXml({ contactId: '42', campaignId: '7' });
    expect(xml).toContain('name="contactId" value="42"');
    expect(xml).toContain('name="campaignId" value="7"');
  });

  it('voiceId defaults to Cantonese_GentleLady when config is null', async () => {
    const xml = await getXml();
    expect(xml).toContain('name="voiceId" value="Cantonese_GentleLady"');
  });

  it('uses voiceId from config when set', async () => {
    setupQueries({ voice_id: 'en-US_Allison', greeting_text: 'Hello', system_prompt: 'You are helpful.' }, { name: 'Alice', phone: '+85299999999', custom_data: {} });
    const xml = await getXml();
    expect(xml).toContain('name="voiceId" value="en-US_Allison"');
  });

  it('interpolates {{name}} with contact name', async () => {
    setupQueries(
      { voice_id: null, greeting_text: 'Hello {{name}}!', system_prompt: 'Help {{name}}.' },
      { name: 'Alice', phone: '+85299999999', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).toContain('Hello Alice!');
  });

  it('interpolates {{business}} with businessName', async () => {
    setupQueries(
      { voice_id: null, greeting_text: 'Welcome to {{business}}', system_prompt: 'You work for {{business}}.' },
      { name: 'Bob', phone: '+85299999999', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).toContain('Welcome to Test Biz');
  });

  it('formats ISO date {{date}} to Chinese 月日 format', async () => {
    setupQueries(
      { voice_id: null, greeting_text: 'Your booking: {{date}}', system_prompt: '' },
      { name: 'C', phone: '+852', custom_data: { date: '2026-06-07' } },
    );
    const xml = await getXml();
    expect(xml).toContain('6月7日');
  });

  it('formats English "jun 7" date to Chinese', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '{{date}}', system_prompt: '' },
      { name: 'D', phone: '+852', custom_data: { date: 'jun 7' } },
    );
    const xml = await getXml();
    expect(xml).toContain('6月7日');
  });

  it('formats 24h time 19:00 to 晚上7時', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '{{time}}', system_prompt: '' },
      { name: 'E', phone: '+852', custom_data: { time: '19:00' } },
    );
    const xml = await getXml();
    expect(xml).toContain('晚上7時');
  });

  it('formats "7pm" to 晚上7時', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '{{time}}', system_prompt: '' },
      { name: 'F', phone: '+852', custom_data: { time: '7pm' } },
    );
    const xml = await getXml();
    expect(xml).toContain('晚上7時');
  });

  it('formats 14:30 to 下午2時30分', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '{{time}}', system_prompt: '' },
      { name: 'G', phone: '+852', custom_data: { time: '14:30' } },
    );
    const xml = await getXml();
    expect(xml).toContain('下午2時30分');
  });

  it('{{date}}{{time}} adjacent replaced with space-separated value', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '{{date}}{{time}}', system_prompt: '' },
      { name: 'H', phone: '+852', custom_data: { date: '2026-06-07', time: '19:00' } },
    );
    const xml = await getXml();
    expect(xml).toContain('6月7日 晚上7時');
    // Should not appear separately
    expect(xml).not.toContain('6月7日晚上7時');
  });

  it('strips {{party_size}} placeholder when no party size in custom_data', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '訂座，{{party_size}}位', system_prompt: '' },
      { name: 'I', phone: '+852', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).not.toContain('{{party_size}}');
    // The comma+位 combo should be stripped from greeting
    expect(xml).not.toContain('，{{party_size}}位');
  });

  it('XML-escapes special characters in parameters', async () => {
    setupQueries(
      { voice_id: null, greeting_text: 'Hello & <World>', system_prompt: '' },
      { name: 'J', phone: '+852', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).toContain('Hello &amp; &lt;World&gt;');
  });

  it('includes HK time in systemPrompt', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '', system_prompt: 'You are helpful.' },
      { name: 'K', phone: '+852', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).toContain('現在香港時間');
  });

  it('appends party-size prompt when partySize is absent', async () => {
    setupQueries(
      { voice_id: null, greeting_text: '', system_prompt: 'Base.' },
      { name: 'L', phone: '+852', custom_data: {} },
    );
    const xml = await getXml();
    expect(xml).toContain('請問到時會有幾多位');
  });
});
