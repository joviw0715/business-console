import Link from 'next/link';
import pool from '@/lib/db';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { CallReport } from '@/types';

async function getReports(campaignId: string): Promise<CallReport[]> {
  try {
    const { rows } = await pool.query<CallReport>(`
      SELECT r.*, ct.name AS contact_name, ct.phone AS contact_phone
      FROM call_reports r
      JOIN contacts ct ON ct.id = r.contact_id
      WHERE r.campaign_id = $1
      ORDER BY r.created_at DESC
    `, [campaignId]);
    return rows;
  } catch { return []; }
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  neutral:  'bg-secondary text-muted-foreground',
  negative: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default async function CampaignReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reports = await getReports(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground flex gap-2">
            <Link href="/campaigns" className="hover:text-foreground">Campaigns</Link>
            <span>/</span>
            <Link href={`/campaigns/${id}`} className="hover:text-foreground">Detail</Link>
            <span>/</span>
            <span className="text-foreground">Reports</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Call Reports</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/api/campaigns/${id}/export`}><Download className="h-4 w-4 mr-1.5" />Export CSV</Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground text-sm">
          No call reports yet. Reports appear after calls complete.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.contact_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.contact_phone}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.duration_sec ? `${Math.floor(r.duration_sec / 60)}m ${r.duration_sec % 60}s` : '—'}
                  </TableCell>
                  <TableCell>
                    {r.outcome ? (
                      <Badge variant="outline" className="text-xs capitalize">{r.outcome.replace('_', ' ')}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {r.sentiment ? (
                      <Badge variant="outline" className={`text-xs capitalize ${SENTIMENT_STYLE[r.sentiment] ?? ''}`}>
                        {r.sentiment}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/campaigns/${id}/reports/${r.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
