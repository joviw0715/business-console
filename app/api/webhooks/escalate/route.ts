import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { timingSafeEqual } from 'crypto';

export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    try {
      const valid = provided.length === secret.length &&
        timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
      if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { call_sid } = body as { call_sid: string };

  console.log(`[escalate] sid=${call_sid}`);

  const { rowCount } = await pool.query(
    `UPDATE inbound_calls SET escalated = true, outcome = 'escalated' WHERE call_sid = $1`,
    [call_sid],
  );

  if (!rowCount) {
    console.warn(`[escalate] no record found for sid=${call_sid}`);
  }

  return NextResponse.json({ ok: true });
}
