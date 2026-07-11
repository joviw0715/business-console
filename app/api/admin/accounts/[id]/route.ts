import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { invalidateCredentialsCache } from '@/lib/credentials';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const allowed = [
    'display_name', 'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number',
    'twilio_whatsapp_number', 'gemini_api_key', 'gemini_model',
    'voice_webhook_url', 'webhook_base_url', 'business_name', 'default_area_code',
    'wa_outbound_enabled', 'wa_inbound_enabled',
    'voice_provider', 'fs_esl_host', 'fs_esl_port', 'fs_esl_password', 'fs_did_number',
  ];

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }

  if ('password' in body && typeof body.password === 'string' && body.password) {
    sets.push(`password_hash = $${idx++}`);
    values.push(await bcrypt.hash(body.password, 12));
  }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  values.push(id);
  await pool.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  invalidateCredentialsCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  if (parseInt(id) === session.accountId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const { rows: [account] } = await pool.query('SELECT is_admin FROM accounts WHERE id = $1', [id]);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (account.is_admin) {
    return NextResponse.json({ error: 'Cannot delete admin account' }, { status: 400 });
  }

  await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
