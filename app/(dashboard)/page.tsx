'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Phone, PhoneIncoming, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Campaign } from '@/types';
import { useLang } from '@/contexts/lang';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { cn } from '@/lib/utils';

type TabGroup = '' | 'active' | 'done' | 'draft';

const PAGE_SIZE = 8;

export default function OutboundPage() {
  const { T, lang } = useLang();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [group, setGroup] = useState<TabGroup>('active');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadCampaigns = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (group) params.set('group', group);
    fetch(`/api/campaigns?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {});
  }, [group, page]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Reset to page 1 when tab changes
  useEffect(() => { setPage(1); }, [group]);

  // Auto-rotate hero every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => setHeroIdx((i) => (i + 1) % TEMPLATE_LIST.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const activeTemplate = TEMPLATE_LIST[heroIdx];

  const TABS: { group: TabGroup; label: string }[] = [
    { group: 'active', label: T.tabActive },
    { group: 'done',   label: T.tabDone   },
    { group: 'draft',  label: T.tabDraft  },
    { group: '',       label: T.tabAll    },
  ];

  return (
    <div className="space-y-3 max-w-4xl mx-auto">

      {/* Pill strip — template selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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

      {/* Compact hero bar */}
      <div className="rounded-xl bg-[#1a7a4a] text-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {activeTemplate.emoji} {activeTemplate.heroTagline[lang]}
          </p>
          <p className="text-xs opacity-70 truncate">{activeTemplate.hint[lang]}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/campaigns/new?template=${activeTemplate.key}`}
            className="flex items-center gap-1.5 rounded-full bg-white text-[#1a7a4a] font-semibold text-xs px-3 py-1.5 hover:bg-white/90 transition-colors whitespace-nowrap"
          >
            <Phone className="h-3.5 w-3.5" />{T.newCampaign}
          </Link>
          <Link
            href={`/inbound/new?template=${activeTemplate.key}`}
            className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/30 text-white font-semibold text-xs px-3 py-1.5 hover:bg-white/20 transition-colors whitespace-nowrap"
          >
            <PhoneIncoming className="h-3.5 w-3.5" />{T.newHotlineBtn}
          </Link>
        </div>
      </div>

      {/* Campaign list */}
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
            {T.yourCampaigns}
            <span className="ml-1.5 font-normal normal-case text-foreground">{total} total</span>
          </h2>
          <Link href="/campaigns/new" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            <Plus className="h-4 w-4 mr-1" />{T.new}
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex border-b border-border gap-0">
          {TABS.map(({ group: g, label }) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn(
                'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                group === g
                  ? 'border-violet-400 text-violet-400 font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            {T.noCampaignsYet}{' '}
            <Link href="/campaigns/new" className="underline">{T.createFirstOne}</Link>.
          </div>
        ) : (
          <>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />{T.previous}
                </button>
                <span className="text-xs text-muted-foreground">{T.pageOf(page, totalPages)}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {T.next}<ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


