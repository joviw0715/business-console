import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limitParsed = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = !Number.isNaN(limitParsed) ? Math.min(1000, Math.max(1, limitParsed)) : null;

  const { rows } = await pool.query(
    `SELECT r.*, ct.name AS contact_name, ct.phone AS contact_phone
     FROM call_reports r JOIN contacts ct ON ct.id = r.contact_id
     WHERE r.campaign_id = $1 ORDER BY r.created_at DESC${limit ? ' LIMIT $2' : ''}`,
    limit ? [id, limit] : [id],
  );

  return NextResponse.json({ reports: rows });
}
