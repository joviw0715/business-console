import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { CallReport } from '@/types';
import { WaSendButton } from './wa-send-button';

async function getReport(reportId: string): Promise<CallReport | null> {
  try {
    const { rows } = await pool.query<CallReport>(`
      SELECT r.*,
        ct.name AS contact_name, ct.phone AS contact_phone, ct.custom_data AS contact_custom_data,
        a.id AS account_id, a.business_name
      FROM call_reports r
      JOIN contacts ct ON ct.id = r.contact_id
      JOIN campaigns c ON c.id = r.campaign_id
      JOIN accounts a ON a.id = c.account_id
      WHERE r.id = $1
    `, [reportId]);
    return rows[0] ?? null;
  } catch { return null; }
}

export default async function CallDetailPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const report = await getReport(rid);
  if (!report) notFound();

  const keyPoints: string[] = Array.isArray(report.key_points) ? report.key_points : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-sm text-muted-foreground flex gap-2">
        <Link href="/campaigns" className="hover:text-foreground">Campaigns</Link>
        <span>/</span>
        <Link href={`/campaigns/${id}`} className="hover:text-foreground">Detail</Link>
        <span>/</span>
        <Link href={`/campaigns/${id}/reports`} className="hover:text-foreground">Reports</Link>
        <span>/</span>
        <span className="text-foreground">Call Detail</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{report.contact_name ?? 'Unknown'}</h1>
        <p className="font-mono text-sm text-muted-foreground">{report.contact_phone}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {report.outcome && (
          <Badge variant="outline" className="capitalize">{report.outcome.replace('_', ' ')}</Badge>
        )}
        {report.sentiment && (
          <Badge variant="outline" className="capitalize">{report.sentiment}</Badge>
        )}
        {report.duration_sec && (
          <Badge variant="secondary">
            {Math.floor(report.duration_sec / 60)}m {report.duration_sec % 60}s
          </Badge>
        )}
        <Badge variant="secondary">{new Date(report.started_at).toLocaleString()}</Badge>
        <WaSendButton
          reportId={report.id}
          campaignId={report.campaign_id}
          waSent={report.wa_confirmation_sent}
          defaultPhone={report.contact_phone ?? ''}
          defaultName={report.contact_name ?? ''}
          defaultDate={report.booking_date ?? (report.contact_custom_data as Record<string,string> | null)?.date ?? ''}
          defaultTime={report.booking_time ?? (report.contact_custom_data as Record<string,string> | null)?.time ?? ''}
          defaultPeople={report.booking_party_size ?? (report.contact_custom_data as Record<string,string> | null)?.party_size ?? ''}
          defaultRestaurant={report.business_name ?? ''}
        />
      </div>

      <Separator />

      {report.summary && (
        <div className="space-y-2">
          <h2 className="font-semibold">Summary</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Key Points</h2>
          <ul className="space-y-1">
            {keyPoints.map((pt, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">·</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.transcript && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="font-semibold">Transcript</h2>
            <ScrollArea className="h-80 rounded-lg border bg-muted/30 p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{report.transcript}</pre>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
