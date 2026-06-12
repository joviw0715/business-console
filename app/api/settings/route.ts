import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);

  const { rows: [account] } = await pool.query(
    `SELECT business_name, wa_outbound_enabled, wa_inbound_enabled, pdf_import_enabled,
            twilio_account_sid, twilio_auth_token, twilio_phone_number,
            twilio_whatsapp_number, gemini_api_key, gemini_model,
            voice_webhook_url, webhook_base_url, default_area_code
     FROM accounts WHERE id = $1`,
    [accountId],
  );

  return NextResponse.json({
    business_name:         account?.business_name ?? '',
    wa_outbound_enabled:   String(account?.wa_outbound_enabled ?? false),
    wa_inbound_enabled:    String(account?.wa_inbound_enabled ?? false),
    pdf_import_enabled:    String(account?.pdf_import_enabled ?? false),
    twilio_account_sid:    account?.twilio_account_sid ?? '',
    twilio_auth_token:     account?.twilio_auth_token ?? '',
    twilio_phone_number:   account?.twilio_phone_number ?? '',
    twilio_whatsapp_number: account?.twilio_whatsapp_number ?? '',
    gemini_api_key:        account?.gemini_api_key ?? '',
    gemini_model:          account?.gemini_model ?? '',
    voice_webhook_url:     account?.voice_webhook_url ?? '',
    webhook_base_url:      account?.webhook_base_url ?? '',
    default_area_code:     account?.default_area_code ?? '+852',
  });
}

export async function PUT(req: Request) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const body = await req.json();

  const allowed = [
    'business_name', 'wa_outbound_enabled', 'wa_inbound_enabled', 'pdf_import_enabled',
    'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number',
    'twilio_whatsapp_number', 'gemini_api_key', 'gemini_model',
    'voice_webhook_url', 'webhook_base_url', 'default_area_code',
  ];

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      const val = (['wa_outbound_enabled', 'wa_inbound_enabled', 'pdf_import_enabled'].includes(key))
        ? body[key] === 'true' || body[key] === true
        : body[key];
      sets.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }

  if (sets.length > 0) {
    values.push(accountId);
    await pool.query(
      `UPDATE accounts SET ${sets.join(', ')} WHERE id = $${idx}`,
      values,
    );
  }

  return NextResponse.json({ ok: true });
}
