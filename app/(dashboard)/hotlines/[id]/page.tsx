'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft, Phone, Trash2, Plus, AlertTriangle, CheckCircle2, PhoneCall, X } from 'lucide-react';
import { useLang } from '@/contexts/lang';

const TABS = ['Live', 'Setup', 'Knowledge', 'Report'] as const;
type Tab = typeof TABS[number];

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Gentle Lady' },
  { id: 'Cantonese_BrightBoy', label: 'Bright Boy' },
  { id: 'Cantonese_WarmLady', label: 'Warm Lady' },
  { id: 'moss_audio_6b759cbc-5c17-11f1-af91-92eea1bed9bb', label: 'Moss' },
];

const OUTCOME_COLORS: Record<string, string> = {
  resolved: 'text-green-400', escalated: 'text-red-400', missed: 'text-yellow-400', abandoned: 'text-muted-foreground',
  follow_up: 'text-orange-400',
};

interface LiveCall {
  id: number; call_sid: string; caller_phone: string;
  started_at: string; escalated: boolean; duration_sec: number;
}

interface InboundCall {
  id: number; caller_phone: string; started_at: string; ended_at: string;
  duration_sec: number; outcome: string; summary: string; transcript: string;
  escalated: boolean; after_hours: boolean;
  follow_up_status: string | null; follow_up_note: string | null;
}

interface KbArticle { id: number; title: string; content: string; }

interface HotlineData {
  id: number; name: string; twilio_number: string; status: string;
  system_prompt: string; voice_id: string; max_call_duration_sec: number;
  business_hours: Record<string, { enabled: boolean; open: string; close: string }>;
  after_hours_message: string; webhook_url: string | null;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function FollowUpCard({ call, hotlineId, unknownCaller, onUpdated, labels }: {
  call: InboundCall;
  hotlineId: string;
  unknownCaller: string;
  onUpdated: () => void;
  labels: {
    followUpBookingConfirmed: string;
    followUpCalledBack: string;
    followUpNoAction: string;
    followUpNotePlaceholder: string;
    saveFollowUp: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(call.follow_up_status ?? '');
  const [note, setNote] = useState(call.follow_up_note ?? '');

  const STATUS_OPTIONS: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: 'booking_confirmed', label: labels.followUpBookingConfirmed, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { value: 'called_back',       label: labels.followUpCalledBack,       icon: <PhoneCall className="h-3.5 w-3.5" /> },
    { value: 'no_action',         label: labels.followUpNoAction,         icon: <X className="h-3.5 w-3.5" /> },
  ];

  const isDone = status === 'booking_confirmed' || status === 'called_back' || status === 'no_action';

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/hotlines/${hotlineId}/calls/${call.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow_up_status: status || 'pending', follow_up_note: note || null }),
    });
    setSaving(false);
    onUpdated();
  }

  return (
    <div className={cn('py-3 space-y-2', isDone && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn('text-sm font-semibold', isDone ? 'text-muted-foreground' : 'text-orange-300')}>
            {call.caller_phone || unknownCaller}
          </p>
          <p className="text-xs text-muted-foreground">
            {call.started_at ? new Date(call.started_at).toLocaleString() : ''}
            {call.duration_sec ? ` · ${call.duration_sec}s` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDone && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {STATUS_OPTIONS.find(o => o.value === status)?.label}
            </span>
          )}
          {call.transcript && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              {expanded ? 'Hide' : 'View transcript'}
            </button>
          )}
        </div>
      </div>

      {call.summary && (
        <p className="text-xs text-foreground/80 leading-relaxed">{call.summary}</p>
      )}

      {expanded && call.transcript && (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-black/20 rounded p-3 max-h-60 overflow-y-auto leading-relaxed">
          {call.transcript}
        </pre>
      )}

      {/* Follow-up action panel */}
      <div className="pt-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(status === opt.value ? '' : opt.value)}
              className={cn(
                'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors',
                status === opt.value
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-violet-500/40',
              )}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={labels.followUpNotePlaceholder}
            className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 px-3 text-xs rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors shrink-0"
          >
            {saving ? '…' : labels.saveFollowUp}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HotlineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { T } = useLang();
  const [id, setId] = useState('');
  const [tab, setTab] = useState<Tab>('Live');
  const [hotline, setHotline] = useState<HotlineData | null>(null);
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<InboundCall[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', content: '', open: false });
  const [editForm, setEditForm] = useState<Partial<HotlineData>>({});
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    params.then(({ id: resolvedId }) => setId(resolvedId));
  }, [params]);

  const loadHotline = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/hotlines/${id}`);
    if (!res.ok) { router.push('/inbound'); return; }
    const data = await res.json();
    setHotline(data);
    setEditForm(data);
  }, [id, router]);

  const loadRecentCalls = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/hotlines/${id}/calls?limit=20`);
    if (res.ok) {
      const data = await res.json();
      setRecentCalls(data.calls ?? []);
    }
  }, [id]);

  const loadKnowledge = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/hotlines/${id}/knowledge`);
    if (res.ok) setArticles(await res.json());
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadHotline();
    loadRecentCalls();
  }, [id, loadHotline, loadRecentCalls]);

  useEffect(() => {
    if (!id || tab !== 'Live') return;
    sseRef.current?.close();
    const es = new EventSource(`/api/hotlines/${id}/live-stream`);
    es.onmessage = (e) => {
      try { setLiveCalls(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    sseRef.current = es;
    return () => es.close();
  }, [id, tab]);

  useEffect(() => {
    if (tab === 'Knowledge') loadKnowledge();
  }, [tab, loadKnowledge]);

  async function handleToggle() {
    if (!id) return;
    setToggling(true);
    await fetch(`/api/hotlines/${id}/toggle`, { method: 'POST' });
    await loadHotline();
    setToggling(false);
  }

  async function handleSaveSetup() {
    if (!id) return;
    setSaving(true);
    await fetch(`/api/hotlines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    await loadHotline();
    setSaving(false);
  }

  async function handleAddArticle() {
    if (!id || !newArticle.title.trim() || !newArticle.content.trim()) return;
    await fetch(`/api/hotlines/${id}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newArticle.title, content: newArticle.content }),
    });
    setNewArticle({ title: '', content: '', open: false });
    loadKnowledge();
  }

  async function handleDeleteArticle(kid: number) {
    if (!id) return;
    await fetch(`/api/hotlines/${id}/knowledge/${kid}`, { method: 'DELETE' });
    loadKnowledge();
  }

  function setHours(day: string, field: 'enabled' | 'open' | 'close', value: string | boolean) {
    setEditForm((f) => ({
      ...f,
      business_hours: {
        ...(f.business_hours ?? {}),
        [day]: { ...(f.business_hours?.[day] ?? { enabled: true, open: '09:00', close: '18:00' }), [field]: value },
      },
    }));
  }

  if (!hotline) {
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  }

  const OUTCOME_LABELS: Record<string, string> = {
    resolved: T.resolved, escalated: T.escalated, missed: T.missed, abandoned: T.abandoned, follow_up: T.follow_up,
  };

  const TAB_LABELS: Record<Tab, string> = {
    Live: T.liveTab, Setup: T.setupTab, Knowledge: T.knowledgeTab, Report: T.reportTab,
  };

  const totalCalls = recentCalls.length;
  const avgDuration = totalCalls > 0
    ? Math.round(recentCalls.filter((c) => c.duration_sec).reduce((s, c) => s + (c.duration_sec ?? 0), 0) / totalCalls)
    : 0;
  const resolvedCount = recentCalls.filter((c) => c.outcome === 'resolved').length;
  const escalatedCount = recentCalls.filter((c) => c.outcome === 'escalated').length;
  const followUpCalls = recentCalls.filter((c) => c.after_hours);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/inbound')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-violet-400" />
            <h1 className="font-semibold">{hotline.name}</h1>
            <span className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
              hotline.status === 'active' ? 'bg-violet-500/10 text-violet-400' : 'bg-secondary text-muted-foreground',
            )}>
              {hotline.status === 'active' ? T.active : T.paused}
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-6">{hotline.twilio_number}</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={handleToggle}
          disabled={toggling}
          className={hotline.status === 'active' ? 'border-violet-500/30 text-violet-400' : ''}
        >
          {hotline.status === 'active' ? T.pause : T.activate}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm transition-colors border-b-2 -mb-px',
              tab === t ? 'border-violet-400 text-violet-400 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Live tab */}
      {tab === 'Live' && (
        <div className="space-y-5">
          {liveCalls.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground tracking-wide">{T.liveNow}</p>
              {liveCalls.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    'rounded-lg border p-4',
                    call.escalated ? 'border-red-500/50 bg-red-500/5 animate-pulse' : 'border-green-500/30 bg-green-500/5',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {call.escalated && <AlertTriangle className="h-4 w-4 text-red-400" />}
                      <p className="text-sm font-medium">{call.caller_phone || T.unknownCaller}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{call.duration_sec}s</span>
                  </div>
                  {call.escalated && (
                    <p className="text-xs text-red-400 mt-1">{T.callerRequestedHuman}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
              {T.noLiveCalls}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground tracking-wide">{T.recentCalls}</p>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{T.noCallsYet}</p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{call.caller_phone || T.unknownCaller}</p>
                      {call.summary && <p className="text-xs text-muted-foreground truncate">{call.summary}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-xs font-medium', OUTCOME_COLORS[call.outcome] ?? 'text-muted-foreground')}>
                        {OUTCOME_LABELS[call.outcome] ?? call.outcome ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{call.duration_sec ? `${call.duration_sec}s` : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Setup tab */}
      {tab === 'Setup' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hotline-name">{T.hotlineName}</Label>
              <Input
                id="hotline-name"
                value={editForm.name ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={T.hotlineNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-number">{T.twilioNumber}</Label>
              <Input
                id="twilio-number"
                value={editForm.twilio_number ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, twilio_number: e.target.value }))}
                placeholder="+85212345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{T.voice}</Label>
            <div className="grid grid-cols-3 gap-3">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, voice_id: v.id }))}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors text-sm',
                    editForm.voice_id === v.id
                      ? 'border-violet-500 bg-violet-500/5 text-violet-400 font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-violet-500/40',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{T.systemPrompt}</Label>
            <Textarea
              value={editForm.system_prompt ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, system_prompt: e.target.value }))}
              rows={7}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>{T.afterHoursMessage}</Label>
            <Textarea
              value={editForm.after_hours_message ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, after_hours_message: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{T.businessHours}</Label>
            <div className="rounded-lg border border-border divide-y divide-border">
              {DAYS.map((day) => {
                const cfg = editForm.business_hours?.[day] ?? { enabled: day !== 'sunday', open: '09:00', close: '18:00' };
                return (
                  <div key={day} className="flex items-center gap-3 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={(e) => setHours(day, 'enabled', e.target.checked)}
                      className="accent-violet-500"
                    />
                    <span className="text-sm capitalize w-24">{day}</span>
                    <Input type="time" value={cfg.open} onChange={(e) => setHours(day, 'open', e.target.value)} disabled={!cfg.enabled} className="h-7 w-28 text-xs" />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input type="time" value={cfg.close} onChange={(e) => setHours(day, 'close', e.target.value)} disabled={!cfg.enabled} className="h-7 w-28 text-xs" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Button onClick={handleSaveSetup} disabled={saving}>
              {saving ? T.saving : T.saveChanges}
            </Button>
            <Button variant="outline" onClick={async () => {
              const name = prompt(T.templateName + ':');
              if (!name?.trim()) return;
              await fetch('/api/user-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: name.trim(),
                  emoji: '⭐',
                  hotline_name: editForm.name ?? null,
                  hotline_system_prompt: editForm.system_prompt ?? null,
                  after_hours_message: editForm.after_hours_message ?? null,
                }),
              });
            }}>
              {T.saveAsTemplate}
            </Button>
          </div>
        </div>
      )}

      {/* Knowledge tab */}
      {tab === 'Knowledge' && (
        <div className="space-y-4">
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{T.noArticlesYet}</p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {articles.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteArticle(a.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {newArticle.open ? (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <Input
                placeholder="Article title"
                value={newArticle.title}
                onChange={(e) => setNewArticle((a) => ({ ...a, title: e.target.value }))}
              />
              <Textarea
                placeholder="Content…"
                value={newArticle.content}
                onChange={(e) => setNewArticle((a) => ({ ...a, content: e.target.value }))}
                rows={5}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddArticle}>{T.saveArticle}</Button>
                <Button size="sm" variant="outline" onClick={() => setNewArticle({ title: '', content: '', open: false })}>
                  {T.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setNewArticle((a) => ({ ...a, open: true }))}>
              <Plus className="h-4 w-4 mr-1" />{T.addArticle}
            </Button>
          )}
        </div>
      )}

      {/* Report tab */}
      {tab === 'Report' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: T.totalCalls, value: totalCalls },
              { label: T.avgDuration, value: avgDuration ? `${avgDuration}s` : '—' },
              { label: T.resolved, value: totalCalls > 0 ? `${Math.round((resolvedCount / totalCalls) * 100)}%` : '—' },
              { label: T.escalated, value: escalatedCount },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {followUpCalls.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-orange-400 tracking-wide">{T.followUpSection}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{T.followUpDesc}</p>
                </div>
                <div className="divide-y divide-orange-500/20 space-y-0">
                  {followUpCalls.map((call) => (
                    <FollowUpCard
                      key={call.id}
                      call={call}
                      hotlineId={id}
                      unknownCaller={T.unknownCaller}
                      onUpdated={loadRecentCalls}
                      labels={{
                        followUpBookingConfirmed: T.followUpBookingConfirmed,
                        followUpCalledBack: T.followUpCalledBack,
                        followUpNoAction: T.followUpNoAction,
                        followUpNotePlaceholder: T.followUpNotePlaceholder,
                        saveFollowUp: T.saveFollowUp,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground tracking-wide">{T.recentCalls}</p>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">{T.noCallsYet}</p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{call.caller_phone || T.unknownCaller}</p>
                      {call.summary && <p className="text-xs text-muted-foreground truncate">{call.summary}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-xs font-medium', OUTCOME_COLORS[call.outcome] ?? 'text-muted-foreground')}>
                        {OUTCOME_LABELS[call.outcome] ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.started_at ? new Date(call.started_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
