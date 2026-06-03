import pool from '@/lib/db';

export interface AccountCredentials {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioWhatsappNumber: string;
  geminiApiKey: string;
  geminiModel: string;
  voiceWebhookUrl: string;
  webhookBaseUrl: string;
  businessName: string;
  defaultAreaCode: string;
  waOutboundEnabled: boolean;
  waInboundEnabled: boolean;
}

let adminCredentials: AccountCredentials | null = null;

async function getAdminDefaults(): Promise<Partial<AccountCredentials>> {
  if (adminCredentials) return adminCredentials;
  const { rows } = await pool.query(
    'SELECT * FROM accounts WHERE is_admin = true LIMIT 1',
  );
  if (!rows[0]) return {};
  const a = rows[0];
  return {
    twilioAccountSid:    a.twilio_account_sid    ?? undefined,
    twilioAuthToken:     a.twilio_auth_token     ?? undefined,
    twilioPhoneNumber:   a.twilio_phone_number   ?? undefined,
    twilioWhatsappNumber: a.twilio_whatsapp_number ?? undefined,
    geminiApiKey:        a.gemini_api_key        ?? undefined,
    geminiModel:         a.gemini_model          ?? undefined,
    voiceWebhookUrl:     a.voice_webhook_url     ?? undefined,
    webhookBaseUrl:      a.webhook_base_url      ?? undefined,
    businessName:        a.business_name         ?? undefined,
    defaultAreaCode:     a.default_area_code     ?? undefined,
  };
}

export async function getAccountCredentials(accountId: number): Promise<AccountCredentials> {
  const { rows } = await pool.query(
    'SELECT * FROM accounts WHERE id = $1',
    [accountId],
  );
  const a = rows[0] ?? {};
  const admin = await getAdminDefaults();

  function resolve(
    own: string | null | undefined,
    adminVal: string | undefined,
    envVal: string | undefined,
    fallback = '',
  ): string {
    return own ?? adminVal ?? envVal ?? fallback;
  }

  return {
    twilioAccountSid:    resolve(a.twilio_account_sid,    admin.twilioAccountSid,    process.env.TWILIO_ACCOUNT_SID),
    twilioAuthToken:     resolve(a.twilio_auth_token,     admin.twilioAuthToken,     process.env.TWILIO_AUTH_TOKEN),
    twilioPhoneNumber:   resolve(a.twilio_phone_number,   admin.twilioPhoneNumber,   process.env.TWILIO_PHONE_NUMBER),
    twilioWhatsappNumber: resolve(a.twilio_whatsapp_number, admin.twilioWhatsappNumber, process.env.TWILIO_WHATSAPP_NUMBER),
    geminiApiKey:        resolve(a.gemini_api_key,        admin.geminiApiKey,        process.env.GEMINI_API_KEY),
    geminiModel:         resolve(a.gemini_model,          admin.geminiModel,         process.env.GEMINI_MODEL,          'gemini-2.0-flash'),
    voiceWebhookUrl:     resolve(a.voice_webhook_url,     admin.voiceWebhookUrl,     process.env.VOICE_WEBHOOK_URL),
    webhookBaseUrl:      resolve(a.webhook_base_url,      admin.webhookBaseUrl,      process.env.WEBHOOK_BASE_URL),
    businessName:        resolve(a.business_name || null, admin.businessName,        process.env.BUSINESS_NAME,         ''),
    defaultAreaCode:     resolve(a.default_area_code,     admin.defaultAreaCode,     process.env.DEFAULT_AREA_CODE,     '+852'),
    waOutboundEnabled:   a.wa_outbound_enabled ?? false,
    waInboundEnabled:    a.wa_inbound_enabled  ?? false,
  };
}
