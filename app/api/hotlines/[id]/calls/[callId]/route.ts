import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const { id, callId } = await params;
  const { follow_up_status, follow_up_note } = await req.json();

  const { rowCount } = await pool.query(
    `UPDATE inbound_calls
     SET follow_up_status = COALESCE($1, follow_up_status),
         follow_up_note   = COALESCE($2, follow_up_note)
     WHERE id = $3 AND hotline_id = $4`,
    [follow_up_status ?? null, follow_up_note ?? null, callId, id],
  );

  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
