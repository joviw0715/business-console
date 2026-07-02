import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

function webhookUrl() {
  return (process.env.VOICE_WEBHOOK_URL || '').replace(/\/$/, '');
}

function token() {
  return process.env.CONSOLE_API_TOKEN || process.env.SESSION_SECRET || '';
}

function authHeaders() {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function GET() {
  await requireAdmin();
  const base = webhookUrl();
  if (!base) return NextResponse.json({ error: 'VOICE_WEBHOOK_URL not set in environment' }, { status: 503 });
  try {
    const res = await fetch(`${base}/admin/providers`, {
      headers: authHeaders(),
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/providers GET] failed to reach voice service:', base, msg);
    return NextResponse.json({ error: `Could not reach voice service (${base}): ${msg}` }, { status: 502 });
  }
}

export async function POST(req: Request) {
  await requireAdmin();
  const base = webhookUrl();
  if (!base) return NextResponse.json({ error: 'VOICE_WEBHOOK_URL not set in environment' }, { status: 503 });
  try {
    const body = await req.json();
    const res = await fetch(`${base}/admin/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/providers POST] failed to reach voice service:', base, msg);
    return NextResponse.json({ error: `Could not reach voice service (${base}): ${msg}` }, { status: 502 });
  }
}
