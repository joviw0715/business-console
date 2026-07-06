import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Do NOT pause the global queue — it would freeze all campaigns across every account.
  // The worker's per-job campaign-status guard already skips jobs for non-running campaigns.
  await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
