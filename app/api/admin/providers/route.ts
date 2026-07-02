import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

function webhookUrl() {
  return (process.env.VOICE_WEBHOOK_URL || '').replace(/\/$/, '');
}

function token() {
  return process.env.CONSOLE_API_TOKEN || process.env.SESSION_SECRET || '';
}

export async function GET() {
  await requireAdmin();
  const base = webhookUrl();
  if (!base) return NextResponse.json({ error: 'VOICE_WEBHOOK_URL not set' }, { status: 503 });
  const res = await fetch(`${base}/admin/providers`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {},
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: Request) {
  await requireAdmin();
  const base = webhookUrl();
  if (!base) return NextResponse.json({ error: 'VOICE_WEBHOOK_URL not set' }, { status: 503 });
  const body = await req.json();
  const res = await fetch(`${base}/admin/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
