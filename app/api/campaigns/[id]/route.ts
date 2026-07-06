import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows } = await pool.query(`
    SELECT c.*, cc.system_prompt, cc.voice_id, cc.greeting_text, cc.max_retries, cc.call_timeout_sec, cc.webhook_url,
      COUNT(ct.id)::int AS total_contacts,
      COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
    FROM campaigns c
    LEFT JOIN campaign_config cc ON cc.campaign_id = c.id
    LEFT JOIN contacts ct ON ct.campaign_id = c.id
    WHERE c.id = $1 AND c.account_id = $2
    GROUP BY c.id, cc.campaign_id
  `, [id, accountId]);
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows } = await pool.query(`
    SELECT
      c.status,
      COUNT(ct.id) AS total_contacts,
      COUNT(cr.id) AS total_reports
    FROM campaigns c
    LEFT JOIN contacts ct ON ct.campaign_id = c.id
    LEFT JOIN call_reports cr ON cr.campaign_id = c.id
    WHERE c.id = $1 AND c.account_id = $2
    GROUP BY c.status
  `, [id, accountId]);

  if (rows.length === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { status, total_contacts, total_reports } = rows[0];
  if (status === 'running') {
    return NextResponse.json(
      { error: 'Campaign is currently running. Pause it before deleting.' },
      { status: 409 },
    );
  }

  await pool.query('DELETE FROM campaigns WHERE id = $1 AND account_id = $2', [id, accountId]);
  return NextResponse.json({
    ok: true,
    deleted: { contacts: parseInt(total_contacts), reports: parseInt(total_reports) },
  });
}
