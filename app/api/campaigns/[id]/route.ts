import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch current campaign state and dependency counts in one query
  const { rows } = await pool.query(`
    SELECT
      c.status,
      COUNT(ct.id) FILTER (WHERE ct.status = 'calling') AS calling_count,
      COUNT(ct.id) AS total_contacts,
      COUNT(cr.id) AS total_reports
    FROM campaigns c
    LEFT JOIN contacts ct ON ct.campaign_id = c.id
    LEFT JOIN call_reports cr ON cr.campaign_id = c.id
    WHERE c.id = $1
    GROUP BY c.status
  `, [id]);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { status, total_contacts, total_reports } = rows[0];

  // Only block deletion if actively running — paused/done campaigns may have stale 'calling' contacts
  if (status === 'running') {
    return NextResponse.json(
      { error: 'Campaign is currently running. Pause it before deleting.' },
      { status: 409 },
    );
  }

  // DELETE CASCADE handles contacts, campaign_config, call_reports automatically
  await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);

  return NextResponse.json({
    ok: true,
    deleted: { contacts: parseInt(total_contacts), reports: parseInt(total_reports) },
  });
}
