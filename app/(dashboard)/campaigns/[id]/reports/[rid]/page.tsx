import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { CallReport } from '@/types';
import { WaSendButton } from './wa-send-button';

async function getReport(reportId: string, accountId: number): Promise<CallReport | null> {
  try {
    const { rows } = await pool.query<CallReport>(`
      SELECT r.*,
        ct.name AS contact_name, ct.phone AS contact_phone, ct.custom_data AS contact_custom_data,
        a.id AS account_id, a.business_name
      FROM call_reports r
      JOIN contacts ct ON ct.id = r.contact_id
      JOIN campaigns c ON c.id = r.campaign_id
      JOIN accounts a ON a.id = c.account_id
      WHERE r.id = $1 AND c.account_id = $2
    `, [reportId, accountId]);
    return rows[0] ?? null;
  } catch { return null; }
}

export default async function CallDetailPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const report = await getReport(rid, accountId);
  if (!report) notFound();

  const keyPoints: string[] = Array.isArray(report.key_points) ? report.key_points : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-sm text-muted-foreground flex gap-2">
        <Link href="/campaigns" className="hover:text-foreground">外撥活動</Link>
        <span>/</span>
        <Link href={`/campaigns/${id}`} className="hover:text-foreground">詳情</Link>
        <span>/</span>
        <Link href={`/campaigns/${id}/reports`} className="hover:text-foreground">報告</Link>
        <span>/</span>
        <span className="text-foreground">通話詳情</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{report.contact_name ?? 'Unknown'}</h1>
        <p className="font-mono text-sm text-muted-foreground">{report.contact_phone}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {report.outcome && (
          <Badge variant="outline">{{
            'booking_confirmed': '已確認訂座',
            'answered': '已接聽',
            'voicemail': '語音信箱',
            'no_answer': '未接聽',
            'busy': '忙線',
            'failed': '失敗',
          }[report.outcome] ?? report.outcome.replace('_', ' ')}</Badge>
        )}
        {report.sentiment && (
          <Badge variant="outline">{{
            'positive': '正面', 'neutral': '中性', 'negative': '負面',
          }[report.sentiment] ?? report.sentiment}</Badge>
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

      {report.recording_url && (
        <div className="space-y-2">
          <h2 className="font-semibold">通話錄音</h2>
          <audio controls src={`/api/recordings/${report.recording_url.split('/').pop()?.replace(/\.mp3$/, '')}`} className="w-full" />
        </div>
      )}

      {report.summary && (
        <div className="space-y-2">
          <h2 className="font-semibold">摘要</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">重點</h2>
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
            <h2 className="font-semibold">通話記錄</h2>
            <ScrollArea className="h-80 rounded-lg border bg-muted/30 p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{report.transcript}</pre>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
