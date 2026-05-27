'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Megaphone } from 'lucide-react';
import type { Campaign } from '@/types';
import { useLang } from '@/contexts/lang';
import { TEMPLATE_LIST } from '@/lib/industry-templates';

interface Stats { active: number; today: number; }

export default function OutboundPage() {
  const { T } = useLang();
  const [stats, setStats] = useState<Stats>({ active: 0, today: 0 });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => {});
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const statsText = stats.active > 0
    ? `${T.campaignsRunning(stats.active)}${stats.today > 0 ? ` · ${T.callsToday(stats.today)}` : ''}`
    : stats.today > 0
      ? T.callsToday(stats.today)
      : T.noActiveCampaigns;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Hero */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">{T.outboundCampaigns}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{statsText}</p>
        </div>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
          <Megaphone className="h-4 w-4 mr-1.5" />{T.newCampaign}
        </Link>
      </div>

      {/* Industry template strip */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold tracking-widest mb-2">{T.industryTemplates}</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TEMPLATE_LIST.map((t) => (
            <Link
              key={t.key}
              href={`/campaigns/new?template=${t.key}`}
              className="flex-none rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors whitespace-nowrap"
            >
              {t.emoji} {t.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
            {T.yourCampaigns}
            <span className="ml-1.5 font-normal normal-case">({campaigns.length})</span>
          </h2>
          <Link href="/campaigns/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            <Plus className="h-4 w-4 mr-1" />{T.new}
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            {T.noCampaignsYet}{' '}
            <Link href="/campaigns/new" className="underline">{T.createFirstOne}</Link>.
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
                    {T.contacts(total)}
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
