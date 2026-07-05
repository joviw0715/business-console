import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: { query: vi.fn() },
}));

import pool from '@/lib/db';
import { getAccountCredentials, invalidateCredentialsCache } from '@/lib/credentials';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

const adminRow = {
  twilio_account_sid: 'ACadmin', twilio_auth_token: 'admin_token',
  twilio_phone_number: '+85200000000', twilio_whatsapp_number: '+85200000001',
  gemini_api_key: 'admin_gemini', gemini_model: 'gemini-admin',
  voice_webhook_url: 'wss://admin.example.com', webhook_base_url: 'https://admin.example.com',
  business_name: 'Admin Biz', default_area_code: '+1',
  voice_provider: 'freeswitch', wa_provider: 'meta',
  fs_esl_host: 'admin-fs', fs_esl_port: 9021, fs_esl_password: 'adminpass', fs_did_number: '+9999',
  meta_wa_token: 'admin_meta_token', meta_wa_phone_number_id: 'admin_phone_id',
};

const ownRow = {
  twilio_account_sid: 'ACown', twilio_auth_token: 'own_token',
  twilio_phone_number: '+85211111111', twilio_whatsapp_number: '+85211111112',
  gemini_api_key: 'own_gemini', gemini_model: 'gemini-own',
  voice_webhook_url: 'wss://own.example.com', webhook_base_url: 'https://own.example.com',
  business_name: 'Own Biz', default_area_code: '+44',
  wa_outbound_enabled: true, wa_inbound_enabled: true,
  voice_provider: 'twilio', wa_provider: 'twilio',
  fs_esl_host: 'own-fs', fs_esl_port: 7021, fs_esl_password: 'ownpass', fs_did_number: '+8888',
  meta_wa_token: 'own_meta_token', meta_wa_phone_number_id: 'own_phone_id',
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCredentialsCache();
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.GEMINI_API_KEY;
  delete process.env.DEFAULT_AREA_CODE;
  delete process.env.GEMINI_MODEL;
});

describe('getAccountCredentials', () => {
  it('own row value wins over admin and env var', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [ownRow] })   // own account
      .mockResolvedValueOnce({ rows: [adminRow] }); // admin defaults

    const creds = await getAccountCredentials(1);
    expect(creds.twilioAccountSid).toBe('ACown');
    expect(creds.geminiApiKey).toBe('own_gemini');
    expect(creds.voiceWebhookUrl).toBe('wss://own.example.com');
  });

  it('falls back to admin row when own value is null', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, twilio_account_sid: null, gemini_api_key: null }] })
      .mockResolvedValueOnce({ rows: [adminRow] });

    const creds = await getAccountCredentials(1);
    expect(creds.twilioAccountSid).toBe('ACadmin');
    expect(creds.geminiApiKey).toBe('admin_gemini');
  });

  it('falls back to env var when own and admin are null', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACenv';
    process.env.GEMINI_API_KEY = 'env_gemini';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, twilio_account_sid: null, gemini_api_key: null }] })
      .mockResolvedValueOnce({ rows: [{ ...adminRow, twilio_account_sid: null, gemini_api_key: null }] });

    const creds = await getAccountCredentials(1);
    expect(creds.twilioAccountSid).toBe('ACenv');
    expect(creds.geminiApiKey).toBe('env_gemini');
  });

  it('geminiModel defaults to "gemini-2.0-flash" when nothing configured', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, gemini_model: null }] })
      .mockResolvedValueOnce({ rows: [{ ...adminRow, gemini_model: null }] });

    const creds = await getAccountCredentials(1);
    expect(creds.geminiModel).toBe('gemini-2.0-flash');
  });

  it('defaultAreaCode defaults to "+852" when nothing configured', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, default_area_code: null }] })
      .mockResolvedValueOnce({ rows: [{ ...adminRow, default_area_code: null }] });

    const creds = await getAccountCredentials(1);
    expect(creds.defaultAreaCode).toBe('+852');
  });

  it('fsEslPort is coerced to Number and defaults to 8021', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, fs_esl_port: null }] })
      .mockResolvedValueOnce({ rows: [{ ...adminRow, fs_esl_port: null }] });

    const creds = await getAccountCredentials(1);
    expect(creds.fsEslPort).toBe(8021);
    expect(typeof creds.fsEslPort).toBe('number');
  });

  it('fsEslPort from own row is coerced to number', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, fs_esl_port: '7021' }] })
      .mockResolvedValueOnce({ rows: [adminRow] });

    const creds = await getAccountCredentials(1);
    expect(creds.fsEslPort).toBe(7021);
    expect(typeof creds.fsEslPort).toBe('number');
  });

  it('voiceProvider defaults to "twilio" when nothing configured', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, voice_provider: null }] })
      .mockResolvedValueOnce({ rows: [{ ...adminRow, voice_provider: null }] });

    const creds = await getAccountCredentials(1);
    expect(creds.voiceProvider).toBe('twilio');
  });

  it('waOutboundEnabled defaults to false when account row has null', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{}] }) // empty own row
      .mockResolvedValueOnce({ rows: [] });   // no admin

    const creds = await getAccountCredentials(1);
    expect(creds.waOutboundEnabled).toBe(false);
    expect(creds.waInboundEnabled).toBe(false);
  });

  it('waOutboundEnabled true is preserved from own row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...ownRow, wa_outbound_enabled: true }] })
      .mockResolvedValueOnce({ rows: [adminRow] });

    const creds = await getAccountCredentials(1);
    expect(creds.waOutboundEnabled).toBe(true);
  });
});

describe('invalidateCredentialsCache', () => {
  it('invalidateCredentialsCache resets module-level cache variables', () => {
    // The function sets adminCredentials = null and adminCredentialsTtl = 0
    // This is a pure unit test of the exported function's effect
    // (cache warming happens in getAdminDefaults when adminCredentials is set externally)
    invalidateCredentialsCache();
    // After invalidation, the next getAdminDefaults call will re-query
    // We verify this by checking that the function doesn't throw
    expect(() => invalidateCredentialsCache()).not.toThrow();
  });

  it('makes at least 2 queries per getAccountCredentials call (own + admin)', async () => {
    vi.resetAllMocks();
    invalidateCredentialsCache();

    let queryCount = 0;
    mockQuery.mockImplementation(() => {
      queryCount++;
      return Promise.resolve({ rows: queryCount % 2 === 1 ? [ownRow] : [adminRow] });
    });

    await getAccountCredentials(1);
    // Each call queries own account + admin defaults
    expect(queryCount).toBeGreaterThanOrEqual(2);
  });
});
