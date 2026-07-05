import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(500, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  // Verify hotline belongs to this account
  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    `SELECT * FROM inbound_calls WHERE hotline_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
    [id, limit, offset],
  );
  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM inbound_calls WHERE hotline_id = $1',
    [id],
  );
  return NextResponse.json({ calls: rows, total: parseInt(count) });
}
