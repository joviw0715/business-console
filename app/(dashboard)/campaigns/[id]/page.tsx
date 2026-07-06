'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import StatCard from '@/components/shared/stat-card';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import CampaignActions from '@/components/campaigns/campaign-actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, UserPlus } from 'lucide-react';
import { useLang } from '@/contexts/lang';
import type { Campaign, Contact } from '@/types';

const VOICE_LABELS: Record<string, string> = {
  'Cantonese_GentleLady': 'Jamie (Female Cantonese)',
  'Cantonese_BrightBoy':  'Kenji (Male Cantonese)',
  'Cantonese_WarmLady':   'Anna (Female English)',
  'moss_audio_6b759cbc-5c17-11f1-af91-92eea1bed9bb': 'Moss',
  'moss_audio_eb6bf7b8-5c1b-11f1-8f84-faf87dcc54b3': 'Test Voice',
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { T } = useLang();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cRes, ctRes, rRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/contacts?limit=50`),
        fetch(`/api/campaigns/${id}/reports?limit=500`),
      ]);
      if (!cRes.ok) { router.push('/campaigns'); return; }
      const c = await cRes.json();
      setCampaign(c);
      if (ctRes.ok) {
        const ctData = await ctRes.json();
        setContacts(ctData.contacts ?? ctData ?? []);
      }
      // Fetch outcome stats from reports
      if (rRes.ok) {
        const rData = await rRes.json();
        const stats: Record<string, number> = {};
        for (const r of (rData.reports ?? rData ?? [])) {
          // booking_confirmed counts as answered for display purposes
          const key = r.outcome === 'booking_confirmed' ? 'answered' : r.outcome;
          stats[key] = (stats[key] ?? 0) + 1;
        }
        setOutcomes(stats);
      }
    } catch {
      router.push('/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading || !campaign) {
    return <div className="text-muted-foreground text-sm p-6">Loading…</div>;
  }

  const pct = campaign.total_contacts
    ? Math.round(((campaign.called_contacts ?? 0) / campaign.total_contacts) * 100)
    : 0;

  const OUTCOME_LABELS: Record<string, string> = {
    answered:  T.statAnswered,
    voicemail: T.statVoicemail,
    no_answer: T.statNotAnswered,
    busy:      T.statBusy,
    failed:    'Failed',
  };

  const STATUS_COLOR: Record<string, string> = {
    pending:  'text-muted-foreground',
    calling:  'text-blue-400',
    done:     'text-emerald-400',
    failed:   'text-destructive',
    skipped:  'text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/campaigns" className="hover:text-foreground">{T.outboundCampaigns}</Link>
            <span>/</span>
            <span className="text-foreground">{campaign.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/campaigns/${id}/contacts/import`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <UserPlus className="h-4 w-4 mr-1.5" />{T.addContactsBtn}
          </Link>
          <CampaignActions campaign={campaign} onAction={load} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{T.contactsCalled(campaign.called_contacts ?? 0, campaign.total_contacts ?? 0)}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{T.tabOverview}</TabsTrigger>
          <TabsTrigger value="contacts">{T.tabContacts}</TabsTrigger>
          <TabsTrigger value="reports" onClick={() => router.push(`/campaigns/${id}/reports`)}>
            {T.tabReports}
          </TabsTrigger>
          <TabsTrigger value="config">{T.tabConfig}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title={T.statCalled}      value={campaign.called_contacts ?? 0} />
            <StatCard title={T.statAnswered}     value={outcomes.answered ?? 0} sub={`${campaign.called_contacts ? Math.round(((outcomes.answered ?? 0) / campaign.called_contacts) * 100) : 0}%`} />
            <StatCard title={T.statNotAnswered}  value={(outcomes.no_answer ?? 0) + (outcomes.voicemail ?? 0) + (outcomes.busy ?? 0)} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title={T.statVoicemail} value={outcomes.voicemail ?? 0} />
            <StatCard title={T.statBusy}      value={outcomes.busy ?? 0} />
            <StatCard title={T.statPending}   value={(campaign.total_contacts ?? 0) - (campaign.called_contacts ?? 0)} />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            <Link href={`/campaigns/${id}/contacts/import`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Upload className="h-4 w-4 mr-1.5" />{T.importCSV}
            </Link>
            <Link href={`/api/campaigns/${id}/export`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Download className="h-4 w-4 mr-1.5" />{T.exportCSV}
            </Link>
          </div>
          {contacts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              {T.noContactsYet}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{T.tabContacts === '聯絡人' ? '姓名' : 'Name'}</TableHead>
                    <TableHead>{T.tabContacts === '聯絡人' ? '電話' : 'Phone'}</TableHead>
                    <TableHead>{T.tabContacts === '聯絡人' ? '狀態' : 'Status'}</TableHead>
                    <TableHead>{T.tabContacts === '聯絡人' ? '結果' : 'Outcome'}</TableHead>
                    <TableHead>{T.tabContacts === '聯絡人' ? '時長' : 'Duration'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name ?? '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium capitalize ${STATUS_COLOR[c.status] ?? ''}`}>
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.outcome ? (
                          <Badge variant="outline" className="text-xs">{OUTCOME_LABELS[c.outcome] ?? c.outcome}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.duration_sec ? `${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <div className="rounded-lg border divide-y text-sm">
            {[
              [T.voiceId,     VOICE_LABELS[campaign.voice_id ?? ''] ?? campaign.voice_id ?? '—'],
              [T.maxRetries,  String(campaign.max_retries ?? 2)],
              [T.callTimeout, `${campaign.call_timeout_sec ?? 60}s`],
              [T.greeting,    campaign.greeting_text ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-3">
                <span className="text-muted-foreground">{k}</span>
                <span className="col-span-2">{v}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <span className="text-muted-foreground block mb-1">{T.systemPrompt}</span>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted rounded p-2 max-h-40 overflow-y-auto">
                {campaign.system_prompt ?? '(using default)'}
              </pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
