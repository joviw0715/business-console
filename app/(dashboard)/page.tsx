'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Phone, PhoneIncoming } from 'lucide-react';
import type { Campaign } from '@/types';
import { useLang } from '@/contexts/lang';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { cn } from '@/lib/utils';

export default function OutboundPage() {
  const { T, lang } = useLang();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    fetch('/api/campaigns').then((r) => r.json()).then(setCampaigns).catch(() => {});
  }, []);

  // Auto-rotate hero every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => setHeroIdx((i) => (i + 1) % TEMPLATE_LIST.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const activeTemplate = TEMPLATE_LIST[heroIdx];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Industry selector — top */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold tracking-widest mb-3">{T.chooseIndustry}</p>

        {/* Pill strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-2">
          {TEMPLATE_LIST.map((t, i) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setHeroIdx(i)}
              className={cn(
                'flex-none rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                i === heroIdx
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
              )}
            >
              {t.emoji} {t.name[lang]}
            </button>
          ))}
        </div>

        {/* 3×2 grid — selection only, no navigation */}
        <div className="grid grid-cols-3 gap-3">
          {TEMPLATE_LIST.map((t, i) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setHeroIdx(i)}
              className={cn(
                'rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-colors',
                i === heroIdx
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-xs font-medium leading-tight">{t.name[lang]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hint line */}
      <p className="text-xs text-muted-foreground -mt-3">{activeTemplate.hint[lang]}</p>

      {/* Hero — shows selected template; CTAs navigate with template param */}
      <div className="rounded-xl bg-[#1a7a4a] text-white p-6 space-y-4">
        <p className="text-sm opacity-80">{T.aiCallingForBusiness}</p>
        <h1 className="text-2xl font-bold leading-tight">
          {activeTemplate.emoji} {activeTemplate.heroTagline[lang]}
        </h1>
        <p className="text-sm opacity-80">{activeTemplate.heroSubtitle[lang]}</p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/campaigns/new?template=${activeTemplate.key}`}
            className="flex items-center gap-1.5 rounded-full bg-white text-[#1a7a4a] font-semibold text-sm px-4 py-2 hover:bg-white/90 transition-colors"
          >
            <Phone className="h-4 w-4" />{T.newCampaign}
          </Link>
          <Link
            href={`/inbound/new?template=${activeTemplate.key}`}
            className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/30 text-white font-semibold text-sm px-4 py-2 hover:bg-white/20 transition-colors"
          >
            <PhoneIncoming className="h-4 w-4" />{T.newHotlineBtn}
          </Link>
        </div>
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
            {T.yourCampaigns}
            <span className="ml-1.5 font-normal normal-case text-foreground">
              {campaigns.length} {campaigns.length === 1 ? 'total' : 'total'}
            </span>
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
                    <p className="font-semibold text-sm leading-tight line-clamp-1">{c.name}</p>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                    {c.scheduled_at && (
                      <span>📅 {new Date(c.scheduled_at).toLocaleDateString()} · {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    <span>👥 {T.contacts(total)}</span>
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
