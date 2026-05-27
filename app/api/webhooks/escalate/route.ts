import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
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
