import Link from 'next/link';
import pool from '@/lib/db';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Megaphone } from 'lucide-react';
import type { Campaign } from '@/types';

const INDUSTRY_TEMPLATES = [
  { key: 'restaurant',    label: '🍽️ Restaurant' },
  { key: 'beauty_salon',  label: '💇 Beauty Salon' },
  { key: 'insurance',     label: '🛡️ Insurance' },
  { key: 'travel_agency', label: '✈️ Travel Agency' },
  { key: 'medical_clinic',label: '🏥 Medical Clinic' },
  { key: 'real_estate',   label: '🏠 Real Estate' },
];

async function getStats() {
  try {
    const [active, today] = await Promise.all([
      pool.query("SELECT COUNT(*)::int FROM campaigns WHERE status = 'running'"),
      pool.query("SELECT COUNT(*)::int FROM call_reports WHERE DATE(created_at) = CURRENT_DATE"),
    ]);
    return {
      active: active.rows[0].count as number,
      today:  today.rows[0].count  as number,
    };
  } catch {
    return { active: 0, today: 0 };
  }
}

async function getCampaigns(): Promise<Campaign[]> {
  try {
    const { rows } = await pool.query<Campaign>(`
      SELECT c.*,
        COUNT(ct.id)::int                                    AS total_contacts,
        COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS called_contacts
      FROM campaigns c
      LEFT JOIN contacts ct ON ct.campaign_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC
    `);
    return rows;
  } catch {
    return [];
  }
}

export default async function OutboundPage() {
  const [stats, campaigns] = await Promise.all([getStats(), getCampaigns()]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Hero */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">Outbound campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.active > 0
              ? `${stats.active} campaign${stats.active !== 1 ? 's' : ''} running · ${stats.today} calls today`
              : stats.today > 0
                ? `${stats.today} calls today`
                : 'No active campaigns'}
          </p>
        </div>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
          <Megaphone className="h-4 w-4 mr-1.5" />New campaign
        </Link>
      </div>

      {/* Industry template strip */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold tracking-widest mb-2">INDUSTRY TEMPLATES</p>
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

      {/* Campaign list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
            Your campaigns
            <span className="ml-1.5 font-normal normal-case">({campaigns.length})</span>
          </h2>
          <Link href="/campaigns/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            <Plus className="h-4 w-4 mr-1" />New
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            No campaigns yet.{' '}
            <Link href="/campaigns/new" className="underline">Create your first one</Link>.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => {
              const total  = c.total_contacts  ?? 0;
              const called = c.called_contacts ?? 0;
              const pct    = total > 0 ? Math.round((called / total) * 100) : 0;
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
                    {total} contact{total !== 1 ? 's' : ''}
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
    </div>
  );
}
