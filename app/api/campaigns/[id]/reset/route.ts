import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT status FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.status === 'running') {
    return NextResponse.json({ error: 'Pause the campaign before resetting.' }, { status: 409 });
  }

  const { rowCount } = await pool.query(
    `UPDATE contacts SET status = 'pending', call_sid = NULL, outcome = NULL,
         duration_sec = NULL, transcript = NULL, summary = NULL, called_at = NULL
     WHERE campaign_id = $1`,
    [id],
  );
  await pool.query("UPDATE campaigns SET status = 'draft', completed_at = NULL WHERE id = $1", [id]);
  return NextResponse.json({ ok: true, reset: rowCount });
}
