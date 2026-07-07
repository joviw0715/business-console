import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { invalidateCredentialsCache } from '@/lib/credentials';

export async function GET() {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);

  const { rows: [account] } = await pool.query(
    `SELECT business_name, wa_outbound_enabled, wa_inbound_enabled, pdf_import_enabled,
            voice_provider, wa_provider,
            fs_esl_host, fs_esl_port, fs_esl_password, fs_did_number,
            meta_wa_token, meta_wa_phone_number_id
     FROM accounts WHERE id = $1`,
    [accountId],
  );

  return NextResponse.json({
    business_name:           account?.business_name ?? '',
    wa_outbound_enabled:     String(account?.wa_outbound_enabled ?? false),
    wa_inbound_enabled:      String(account?.wa_inbound_enabled ?? false),
    pdf_import_enabled:      String(account?.pdf_import_enabled ?? false),
    voice_provider:          account?.voice_provider ?? 'twilio',
    wa_provider:             account?.wa_provider ?? 'twilio',
    fs_esl_host:             account?.fs_esl_host ?? '',
    fs_esl_port:             account?.fs_esl_port ?? 8021,
    fs_esl_password:         account?.fs_esl_password ?? '',
    fs_did_number:           account?.fs_did_number ?? '',
    meta_wa_token:           account?.meta_wa_token ?? '',
    meta_wa_phone_number_id: account?.meta_wa_phone_number_id ?? '',
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
    'voice_provider', 'wa_provider',
    'fs_esl_host', 'fs_esl_port', 'fs_esl_password', 'fs_did_number',
    'meta_wa_token', 'meta_wa_phone_number_id',
  ];

  const boolFields = ['wa_outbound_enabled', 'wa_inbound_enabled', 'pdf_import_enabled'];

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      const val = boolFields.includes(key)
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
    invalidateCredentialsCache();
  }

  return NextResponse.json({ ok: true });
}
