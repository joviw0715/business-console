import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { call_sid, hotline_id, caller_phone } = body as {
    call_sid: string; hotline_id: number; caller_phone?: string;
  };

  console.log(`[inbound/call-start] sid=${call_sid} hotline=${hotline_id} caller=${caller_phone}`);

  try {
    const { rows: [row] } = await pool.query(
      `INSERT INTO inbound_calls (hotline_id, call_sid, caller_phone, account_id)
       VALUES ($1, $2, $3, (SELECT account_id FROM hotlines WHERE id = $1))
       RETURNING id`,
      [hotline_id, call_sid, caller_phone ?? null],
    );
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[inbound/call-start] DB error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
