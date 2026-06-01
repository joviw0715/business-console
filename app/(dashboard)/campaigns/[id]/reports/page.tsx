'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useLang } from '@/contexts/lang';
import type { CallReport } from '@/types';

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  neutral:  'bg-secondary text-muted-foreground',
  negative: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function CampaignReportsPage() {
  const params = useParams();
  const id = String(params.id);
  const { T } = useLang();
  const [reports, setReports] = useState<CallReport[]>([]);

  useEffect(() => {
    fetch(`/api/campaigns/${id}/reports?limit=200`)
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? data ?? []))
      .catch(() => {});
  }, [id]);

  const isZh = T.tabContacts === '聯絡人';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground flex gap-2">
            <Link href="/campaigns" className="hover:text-foreground">{T.outboundCampaigns}</Link>
            <span>/</span>
            <Link href={`/campaigns/${id}`} className="hover:text-foreground">{isZh ? '詳情' : 'Detail'}</Link>
            <span>/</span>
            <span className="text-foreground">{T.tabReports}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{T.callReports}</h1>
        </div>
        <Link href={`/api/campaigns/${id}/export`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Download className="h-4 w-4 mr-1.5" />{T.exportCSV}
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground text-sm">
          {T.noCallReports}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isZh ? '聯絡人' : 'Contact'}</TableHead>
                <TableHead>{isZh ? '時間' : 'Time'}</TableHead>
                <TableHead>{isZh ? '時長' : 'Duration'}</TableHead>
                <TableHead>{isZh ? '結果' : 'Outcome'}</TableHead>
                <TableHead>{isZh ? '情緒' : 'Sentiment'}</TableHead>
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
                    <Link href={`/campaigns/${id}/reports/${r.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                      {isZh ? '查看' : 'View'}
                    </Link>
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
