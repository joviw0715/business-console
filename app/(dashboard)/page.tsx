import Link from 'next/link';
import pool from '@/lib/db';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, PhoneIncoming, Megaphone } from 'lucide-react';
import type { Campaign } from '@/types';

const INDUSTRY_TEMPLATES = [
  { key: 'restaurant', label: '🍽️ Restaurant' },
  { key: 'beauty_salon', label: '💇 Beauty Salon' },
  { key: 'insurance', label: '🛡️ Insurance' },
  { key: 'travel_agency', label: '✈️ Travel Agency' },
  { key: 'medical_clinic', label: '🏥 Medical Clinic' },
  { key: 'real_estate', label: '🏠 Real Estate' },
];

async function getStats() {
  try {
    const [total, today, active, outcomes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM call_reports'),
      pool.query("SELECT COUNT(*) FROM call_reports WHERE DATE(created_at) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'running'"),
      pool.query(`
        SELECT outcome, COUNT(*) as count FROM call_reports
        WHERE DATE(created_at) = CURRENT_DATE GROUP BY outcome
      `),
    ]);
    return {
      total: parseInt(total.rows[0].count),
      today: parseInt(today.rows[0].count),
      active: parseInt(active.rows[0].count),
      outcomes: outcomes.rows as { outcome: string; count: string }[],
    };
  } catch {
    return { total: 0, today: 0, active: 0, outcomes: [] };
  }
}

async function getCampaigns(): Promise<Campaign[]> {
  try {
    const { rows } = await pool.query<Campaign>(`
      SELECT c.*,
        COUNT(ct.id)::int AS total_contacts,
        COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
      FROM campaigns c
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT 20
    `);
    return rows;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [stats, campaigns] = await Promise.all([getStats(), getCampaigns()]);

  const outcomeMap = Object.fromEntries(stats.outcomes.map((o) => [o.outcome, parseInt(o.count)]));
  const connectRate =
    stats.today > 0 ? Math.round(((outcomeMap.answered ?? 0) / stats.today) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero banner */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">AI calling for your business</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automate outbound campaigns and manage inbound hotlines with AI voice agents.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
            <Megaphone className="h-4 w-4 mr-1.5" />New campaign
          </Link>
          <Link href="/hotlines/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <PhoneIncoming className="h-4 w-4 mr-1.5" />New hotline
          </Link>
        </div>
      </div>

      {/* Industry template strip */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium tracking-wide">INDUSTRY TEMPLATES</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {INDUSTRY_TEMPLATES.map((t) => (
            <Link
              key={t.key}
              href={`/campaigns/new?template=${t.key}`}
              className="flex-none rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors whitespace-nowrap"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: stats.total },
          { label: "Today's Calls", value: stats.today },
          { label: 'Active Campaigns', value: stats.active },
          { label: 'Connect Rate', value: `${connectRate}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your campaigns <span className="text-muted-foreground font-normal text-sm">({campaigns.length})</span></h2>
          <Link href="/campaigns/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            <Plus className="h-4 w-4 mr-1" />New
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            No campaigns yet. <Link href="/campaigns/new" className="underline">Create one</Link>.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => {
              const total = c.total_contacts ?? 0;
              const called = c.called_contacts ?? 0;
              const pct = total > 0 ? Math.round((called / total) * 100) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium text-sm leading-tight line-clamp-1">{c.name}</p>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {total} contacts
                    {c.scheduled_at && ` · ${new Date(c.scheduled_at).toLocaleDateString()}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{called}/{total}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's outcomes */}
      {stats.today > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Today&apos;s outcomes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Answered',  value: outcomeMap.answered  ?? 0 },
              { label: 'Voicemail', value: outcomeMap.voicemail ?? 0 },
              { label: 'No Answer', value: outcomeMap.no_answer ?? 0 },
              { label: 'Busy',      value: outcomeMap.busy      ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
