import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [owned] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!owned) return new Response('Not found', { status: 404 });

  const { rows } = await pool.query(
    `SELECT ct.name, ct.phone, ct.status, ct.outcome, ct.duration_sec,
            ct.called_at,
            (SELECT r.summary FROM call_reports r WHERE r.contact_id = ct.id ORDER BY r.created_at DESC LIMIT 1) AS summary,
            (SELECT r.sentiment FROM call_reports r WHERE r.contact_id = ct.id ORDER BY r.created_at DESC LIMIT 1) AS sentiment,
            (SELECT r.key_points FROM call_reports r WHERE r.contact_id = ct.id ORDER BY r.created_at DESC LIMIT 1) AS key_points
     FROM contacts ct
     WHERE ct.campaign_id = $1 ORDER BY ct.created_at`,
    [id],
  );

  const headers = ['name', 'phone', 'status', 'outcome', 'duration_sec', 'called_at', 'summary', 'sentiment', 'key_points'];
  const csv = [
    headers.join(','),
    ...rows.map((r: Record<string, unknown>) =>
      headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = Array.isArray(val) ? val.join('; ') : String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    ),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="campaign-${id}-export.csv"`,
    },
  });
}
