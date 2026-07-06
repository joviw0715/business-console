'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CampaignStatusBadge from '@/components/campaigns/campaign-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Plus, Phone, PhoneIncoming, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Campaign } from '@/types';
import { useLang } from '@/contexts/lang';
import { TEMPLATE_LIST, type IndustryTemplate } from '@/lib/industry-templates';
import { cn } from '@/lib/utils';

type TabGroup = '' | 'active' | 'done' | 'draft';

const PAGE_SIZE = 8;

interface UserTemplate {
  id: number; name: string; emoji: string;
  campaign_name: string | null; greeting_text: string | null; system_prompt: string | null;
  hotline_name: string | null; hotline_system_prompt: string | null; after_hours_message: string | null;
}

// Shape user template into the same structure the hero bar expects
function toHeroShape(t: UserTemplate, lang: string): IndustryTemplate {
  const s = (v: string | null) => v ?? '';
  return {
    key: `user_${t.id}`,
    emoji: t.emoji,
    name:                  { en: t.name, zh: t.name, pt: t.name },
    heroTagline:           { en: t.name, zh: t.name, pt: t.name },
    heroSubtitle:          { en: '', zh: '', pt: '' },
    hint:                  { en: t.name, zh: t.name, pt: t.name },
    sampleCampaignName:    { en: s(t.campaign_name), zh: s(t.campaign_name), pt: s(t.campaign_name) },
    sampleScript:          { en: s(t.system_prompt),  zh: s(t.system_prompt),  pt: s(t.system_prompt)  },
    sampleGreeting:        { en: s(t.greeting_text),  zh: s(t.greeting_text),  pt: s(t.greeting_text)  },
    hotlineName:           { en: s(t.hotline_name),   zh: s(t.hotline_name),   pt: s(t.hotline_name)   },
    hotlineSystemPrompt:   { en: s(t.hotline_system_prompt), zh: s(t.hotline_system_prompt), pt: s(t.hotline_system_prompt) },
    afterHoursMessage:     { en: s(t.after_hours_message), zh: s(t.after_hours_message), pt: s(t.after_hours_message) },
    greetingText:          s(t.greeting_text),
    systemPrompt:          s(t.system_prompt),
  };
}

export default function OutboundPage() {
  const { T, lang } = useLang();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [group, setGroup] = useState<TabGroup>('active');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // All templates = built-ins + user's custom ones
  const allTemplates: IndustryTemplate[] = [
    ...TEMPLATE_LIST,
    ...userTemplates.map((t) => toHeroShape(t, lang)),
  ];

  useEffect(() => {
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

  useEffect(() => {
    fetch('/api/user-templates').then((r) => r.json()).then(setUserTemplates).catch(() => {});
  }, []);

  // Auto-rotate hero through built-in templates only
  useEffect(() => {
    const timer = setInterval(() => setHeroIdx((i) => (i + 1) % TEMPLATE_LIST.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const activeTemplate = allTemplates[heroIdx] ?? allTemplates[0];
  const isUserTemplate = heroIdx >= TEMPLATE_LIST.length;

  const TABS: { group: TabGroup; label: string }[] = [
    { group: 'active', label: T.tabActive },
    { group: 'done',   label: T.tabDone   },
    { group: 'draft',  label: T.tabDraft  },
    { group: '',       label: T.tabAll    },
  ];

  return (
    <div className="space-y-3 max-w-4xl mx-auto">

      {/* Pill strip — template selector (built-ins + user custom) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {allTemplates.map((t, i) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setHeroIdx(i)}
            className={cn(
              'flex-none rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              i === heroIdx
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
              i >= TEMPLATE_LIST.length && 'border-dashed',
            )}
          >
            {t.emoji} {t.name.zh}
          </button>
        ))}
      </div>

      {/* Compact hero bar */}
      <div className="rounded-xl bg-[#1a7a4a] text-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">
            {activeTemplate.emoji} {activeTemplate.heroTagline.zh}
          </p>
          <p className="text-xs opacity-70 truncate">{activeTemplate.hint.zh}</p>
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
            <span className="ml-1.5 font-normal normal-case text-foreground">{T.totalLabel(total)}</span>
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
              onClick={() => { setGroup(g); setPage(1); }}
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
                const n      = c.total_contacts  ?? 0;
                const called = c.called_contacts ?? 0;
                const pct    = n > 0 ? Math.round((called / n) * 100) : 0;
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
                      <span>👥 {T.contacts(n)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{called}/{n}</span>
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


