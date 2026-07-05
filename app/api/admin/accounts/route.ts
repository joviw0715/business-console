import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT id, username, display_name, is_admin, created_at,
            (twilio_account_sid IS NOT NULL AND twilio_account_sid <> '') AS has_twilio_sid,
            (twilio_auth_token  IS NOT NULL AND twilio_auth_token  <> '') AS has_twilio_token,
            (twilio_phone_number IS NOT NULL AND twilio_phone_number <> '') AS has_twilio_phone,
            (gemini_api_key     IS NOT NULL AND gemini_api_key     <> '') AS has_gemini_key,
            (voice_webhook_url  IS NOT NULL AND voice_webhook_url  <> '') AS has_webhook_url,
            (webhook_base_url   IS NOT NULL AND webhook_base_url   <> '') AS has_base_url,
            (SELECT COUNT(*)::int FROM hotlines WHERE account_id = accounts.id) AS hotline_count,
            (SELECT COUNT(*)::int FROM campaigns WHERE account_id = accounts.id) AS campaign_count,
            (SELECT COUNT(*)::int FROM inbound_calls WHERE account_id = accounts.id) AS inbound_count,
            (SELECT COUNT(*)::int FROM call_reports cr JOIN campaigns c ON c.id = cr.campaign_id WHERE c.account_id = accounts.id) AS outbound_count
     FROM accounts ORDER BY created_at ASC`,
  );
  return NextResponse.json(rows.map(({ has_twilio_sid, has_twilio_token, has_twilio_phone, has_gemini_key, has_webhook_url, has_base_url, ...r }) => ({
    ...r,
    setup_health: ([has_twilio_sid, has_twilio_token, has_twilio_phone, has_gemini_key, has_webhook_url, has_base_url].filter(Boolean).length >= 5)
      ? 'ready'
      : ([has_twilio_sid, has_gemini_key].some(Boolean) ? 'partial' : 'not_configured'),
  })));
}

export async function POST(req: Request) {
  await requireAdmin();
  const { username, password, displayName } = await req.json();

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { rows: [account] } = await pool.query(
      `INSERT INTO accounts (username, password_hash, display_name)
       VALUES ($1, $2, $3) RETURNING id, username, display_name, created_at`,
      [username.trim(), passwordHash, displayName?.trim() || null],
    );
    return NextResponse.json(account, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
