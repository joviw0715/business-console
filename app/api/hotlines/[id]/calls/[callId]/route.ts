import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id, callId } = await params;
  const { follow_up_status, follow_up_note } = await req.json();

  // Verify hotline belongs to account
  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
