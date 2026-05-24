import Link from 'next/link';
import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import StatCard from '@/components/shared/stat-card';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import CampaignActions from '@/components/campaigns/campaign-actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download } from 'lucide-react';
import type { Campaign, Contact } from '@/types';

async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const { rows } = await pool.query<Campaign>(`
      SELECT c.*, cc.system_prompt, cc.voice_id, cc.greeting_text, cc.max_retries, cc.call_timeout_sec, cc.webhook_url,
        COUNT(ct.id)::int AS total_contacts,
        COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
      FROM campaigns c
      LEFT JOIN campaign_config cc ON cc.campaign_id = c.id
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
      WHERE c.id = $1 GROUP BY c.id, cc.campaign_id
    `, [id]);
    return rows[0] ?? null;
  } catch { return null; }
}

async function getContacts(id: string): Promise<Contact[]> {
  try {
    const { rows } = await pool.query<Contact>(
      'SELECT * FROM contacts WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 50',
      [id],
    );
    return rows;
  } catch { return []; }
}

async function getOutcomeStats(id: string) {
  try {
    const { rows } = await pool.query(
      "SELECT outcome, COUNT(*)::int as count FROM call_reports WHERE campaign_id = $1 GROUP BY outcome",
      [id],
    );
    return Object.fromEntries(rows.map((r: { outcome: string; count: number }) => [r.outcome, r.count]));
  } catch { return {}; }
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, contacts, outcomes] = await Promise.all([getCampaign(id), getContacts(id), getOutcomeStats(id)]);

  if (!campaign) notFound();

  const pct = campaign.total_contacts
    ? Math.round(((campaign.called_contacts ?? 0) / campaign.total_contacts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/campaigns" className="hover:text-foreground">Campaigns</Link>
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
        <CampaignActions campaign={campaign} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{campaign.called_contacts ?? 0} / {campaign.total_contacts ?? 0} contacts called</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="reports">
            <Link href={`/campaigns/${id}/reports`}>Reports</Link>
          </TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Called"       value={campaign.called_contacts ?? 0} />
            <StatCard title="Answered"     value={outcomes.answered ?? 0} sub={`${campaign.called_contacts ? Math.round(((outcomes.answered ?? 0) / campaign.called_contacts) * 100) : 0}%`} />
            <StatCard title="Not Answered" value={(outcomes.no_answer ?? 0) + (outcomes.voicemail ?? 0) + (outcomes.busy ?? 0)} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Voicemail"    value={outcomes.voicemail ?? 0} />
            <StatCard title="Busy"         value={outcomes.busy ?? 0} />
            <StatCard title="Pending"      value={(campaign.total_contacts ?? 0) - (campaign.called_contacts ?? 0)} />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/campaigns/${id}/contacts/import`}><Upload className="h-4 w-4 mr-1.5" />Import CSV</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/campaigns/${id}/export`}><Download className="h-4 w-4 mr-1.5" />Export</Link>
            </Button>
          </div>
          <ContactsTable contacts={contacts} />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <div className="rounded-lg border divide-y text-sm">
            {[
              ['Voice ID', campaign.voice_id ?? '—'],
              ['Max Retries', campaign.max_retries?.toString() ?? '2'],
              ['Call Timeout', `${campaign.call_timeout_sec ?? 60}s`],
              ['Greeting', campaign.greeting_text ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-3">
                <span className="text-muted-foreground">{k}</span>
                <span className="col-span-2">{v}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <span className="text-muted-foreground block mb-1">System Prompt</span>
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

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const OUTCOME_LABELS: Record<string, string> = {
    answered: 'Answered', voicemail: 'Voicemail', no_answer: 'No Answer', busy: 'Busy', failed: 'Failed',
  };
  const STATUS_COLOR: Record<string, string> = {
    pending: 'text-muted-foreground', calling: 'text-blue-400', done: 'text-emerald-400',
    failed: 'text-destructive', skipped: 'text-muted-foreground',
  };

  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
        No contacts yet. Import a CSV to get started.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Duration</TableHead>
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
  );
}
