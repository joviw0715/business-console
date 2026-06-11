'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, Upload, ImageIcon, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';
import Link from 'next/link';

interface CampaignTemplate {
  id: number; name: string; emoji: string; industry: string | null;
  voice_id: string; script: string; greeting: string; is_builtin: boolean;
}

interface BookingRow {
  id: string; name: string; phone: string;
  schedule: string; date: string; remarks: string;
}

const AREA_CODES = [
  { code: '+852', label: '🇭🇰 +852', name: 'Hong Kong' },
  { code: '+86',  label: '🇨🇳 +86',  name: 'China'     },
  { code: '+853', label: '🇲🇴 +853', name: 'Macau'     },
  { code: '+65',  label: '🇸🇬 +65',  name: 'Singapore' },
  { code: '+44',  label: '🇬🇧 +44',  name: 'UK'        },
  { code: '+1',   label: '🇺🇸 +1',   name: 'US'        },
];

function normalizePhone(local: string, areaCode: string): string {
  const stripped = local.trim().replace(/[\s\-\.]/g, '');
  if (!stripped) return '';
  if (stripped.startsWith('+')) return stripped;
  return `${areaCode}${stripped.replace(/^0+/, '')}`;
}

function now() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultTime() {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NewCampaignPage() {
  return (
    <Suspense>
      <NewCampaignInner />
    </Suspense>
  );
}

function NewCampaignInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { T } = useLang();

  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState(now());
  const [bookingDate, setBookingDate] = useState(todayStr());
  const [bookingTime, setBookingTime] = useState(defaultTime());
  const [areaCode, setAreaCode] = useState('+852');
  const [bookings, setBookings] = useState<BookingRow[]>([
    { id: crypto.randomUUID(), name: '', phone: '', schedule: '', date: '', remarks: '' },
  ]);
  const [schedule, setSchedule] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  useEffect(() => {
    fetch('/api/campaign-templates').then((r) => r.json()).then((data: CampaignTemplate[]) => {
      setTemplates(data);
      // Pre-select from URL ?template= param
      const key = searchParams.get('template');
      if (key) {
        const match = data.find((t) => t.industry === key || String(t.id) === key);
        if (match) setSelectedTemplateId(match.id);
      } else if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    }).catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      if (s.default_area_code) setAreaCode(s.default_area_code);
    }).catch(() => {});
  }, [searchParams]);

  function addBooking() {
    setBookings((b) => [...b, { id: crypto.randomUUID(), name: '', phone: '', schedule: '', date: '', remarks: '' }]);
  }

  function removeBooking(id: string) {
    setBookings((b) => b.filter((r) => r.id !== id));
  }

  function updateBooking(id: string, field: keyof BookingRow, value: string) {
    setBookings((b) => b.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function handleCsv(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n').filter(Boolean).slice(1);
      const parsed: BookingRow[] = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
        return {
          id: crypto.randomUUID(),
          name:     parts[0] ?? '',
          phone:    normalizePhone(parts[1] ?? '', areaCode),
          schedule: parts[2] ?? '',
          date:     parts[3] ?? '',
          remarks:  parts[4] ?? '',
        };
      }).filter((r) => r.phone);
      if (parsed.length > 0) setBookings(parsed);
    };
    reader.readAsText(file);
  }

  function downloadTemplateCsv(full: boolean) {
    const header = full
      ? 'Name,Telephone,Schedule,Date,Remark\n'
      : 'Name,Telephone\n';
    const examples = full
      ? 'Jovi,88888888,7pm,30-May,4ppl\nKen,90218835,6pm,30-May,2ppl\n'
      : 'Jovi,88888888\nKen,90218835\n';
    const blob = new Blob([header + examples], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = full ? 'bookings-template-full.csv' : 'bookings-template-simple.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImage(file: File) {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/campaigns/extract-contacts', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const extracted: BookingRow[] = (data.contacts ?? []).map((c: { name: string; phone: string; time?: string; date?: string; party_size?: string; remarks?: string; custom_field?: string }) => {
        const fullPhone = normalizePhone(c.phone ?? '', areaCode);
        // Strip the area code prefix for display — the dropdown already shows it
        const displayPhone = fullPhone.startsWith(areaCode)
          ? fullPhone.slice(areaCode.length)
          : fullPhone;
        return {
          id: crypto.randomUUID(),
          name: c.name ?? '',
          phone: displayPhone,
          schedule: c.time ?? '',
          date: c.date ?? '',
          remarks: [c.party_size ? `${c.party_size}位` : '', c.remarks ?? ''].filter(Boolean).join(' ') || (c.custom_field ?? ''),
        };
      });
      if (extracted.length > 0) setBookings(extracted);
    } catch (e) {
      setError(`Image extract failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
    }
  }

  async function handleLaunch() {
    if (!selectedTemplate) { setError('Please select a template'); return; }
    const validBookings = bookings.filter((b) => b.phone.trim());
    if (validBookings.length === 0) { setError('Add at least one booking with a phone number'); return; }

    setSaving(true);
    setError('');
    try {
      const contacts = validBookings.map((b) => ({
        name: b.name || null,
        phone: normalizePhone(b.phone.trim(), areaCode),
        custom_field: JSON.stringify({
          date:       b.date     || bookingDate,
          time:       b.schedule || bookingTime,
          party_size: b.remarks?.match(/^(\d+)位/)?.[1] || '',
          remarks:    b.remarks?.replace(/^\d+位\s*/, '') || '',
        }),
      }));

      const scheduledAtValue = schedule === 'later' && scheduledAt ? scheduledAt : null;

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          system_prompt: selectedTemplate.script,
          greeting_text: selectedTemplate.greeting,
          voice_id: selectedTemplate.voice_id,
          scheduled_at: scheduledAtValue,
          contacts,
          campaign_template_id: selectedTemplateId,
        }),
      });

      if (!res.ok) {
        setError(`Failed (${res.status}): ${await res.text()}`);
        setSaving(false);
        return;
      }

      const { id } = await res.json();

      if (!scheduledAtValue) {
        await fetch(`/api/campaigns/${id}/start`, { method: 'POST' });
      }

      router.push(`/campaigns/${id}`);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  }

  const validCount = bookings.filter((b) => normalizePhone(b.phone.trim(), areaCode).length > 0).length;

  return (
    <div className="max-w-lg mx-auto pb-40">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-bold text-lg flex-1">{T.newCampaignTitle}</h1>
      </div>

      {/* ── Step 1: Template ── */}
      <section className="space-y-3 mb-8">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{T.campaignStep1}</p>
          <Link href="/campaigns/templates" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Settings2 className="h-3 w-3" />{T.manageTemplates}
          </Link>
        </div>

        {/* Template dropdown */}
        <div className="relative">
          <select
            value={selectedTemplateId ?? ''}
            onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— {T.tabAll} —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
            ))}
          </select>
        </div>

        {/* Script preview */}
        {selectedTemplate && (
          <div className="rounded-md bg-secondary/50 border border-border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {selectedTemplate.voice_id === 'Cantonese_GentleLady' ? 'female cantonese' :
             selectedTemplate.voice_id === 'Cantonese_BrightBoy'  ? 'male cantonese'   :
             selectedTemplate.voice_id === 'Cantonese_WarmLady'   ? 'female english'   : selectedTemplate.voice_id}{' · '}
            {selectedTemplate.script || selectedTemplate.greeting}
          </div>
        )}
      </section>

      {/* ── Step 2: Campaign ── */}
      <section className="space-y-4 mb-8">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{T.campaignStep2}</p>

        <div>
          <Label className="text-xs text-muted-foreground">{T.campaignNameLabel}</Label>
          <div className="flex gap-2 mt-1">
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="h-9 text-sm flex-1" />
            <Button variant="outline" size="sm" onClick={() => setCampaignName(now())}>{T.reset}</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{T.autoFilledHint}</p>
        </div>

        <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
          <div>
            <Label className="text-xs text-muted-foreground">{T.defaultDateTimeLabel}</Label>
            <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="h-9 text-sm mt-1 w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground sm:invisible">&nbsp;</Label>
            <Input type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="h-9 text-sm mt-1 w-full" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{T.defaultDateTimeHint}</p>
      </section>

      {/* ── Step 3: Bookings ── */}
      <section className="space-y-3 mb-8">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">3. {T.bookings}</p>

        {bookings.map((b, i) => (
          <div key={b.id} className="rounded-lg border border-border p-3 space-y-2 relative">
            <p className="text-xs text-muted-foreground font-medium">{T.bookingLabel(i + 1)}</p>
            {bookings.length > 1 && (
              <button
                onClick={() => removeBooking(b.id)}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <Input
              placeholder={T.bookingName}
              value={b.name}
              onChange={(e) => updateBooking(b.id, 'name', e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-1.5">
              <select
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
              >
                {AREA_CODES.map((ac) => (
                  <option key={ac.code} value={ac.code}>{ac.label}</option>
                ))}
              </select>
              <Input
                placeholder="88888888"
                value={b.phone}
                onChange={(e) => updateBooking(b.id, 'phone', e.target.value)}
                className="h-8 text-sm font-mono flex-1"
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                placeholder={`${T.bookingTime} (optional)`}
                value={b.schedule}
                onChange={(e) => updateBooking(b.id, 'schedule', e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder={`${T.bookingDate} (optional)`}
                value={b.date}
                onChange={(e) => updateBooking(b.id, 'date', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground/60">{T.perBookingDateTimeHint}</p>
            <Input
              placeholder={`${T.bookingRemarks} (optional)`}
              value={b.remarks}
              onChange={(e) => updateBooking(b.id, 'remarks', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        ))}

        <button
          onClick={addBooking}
          className="w-full h-9 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />{T.addBooking}
        </button>

        {/* Import row */}
        <div className="flex gap-2">
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }} />
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); e.target.value = ''; }} />
          <button
            onClick={() => imgRef.current?.click()}
            disabled={extracting}
            className="flex-1 h-9 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {T.importImage}
          </button>
          <button
            onClick={() => csvRef.current?.click()}
            className="flex-1 h-9 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />{T.importCsv}
          </button>
        </div>

        {/* Download template */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{T.downloadTemplate}</span>
          <button onClick={() => downloadTemplateCsv(true)} className="underline hover:text-foreground transition-colors">
            {T.downloadFull}
          </button>
          <span>·</span>
          <button onClick={() => downloadTemplateCsv(false)} className="underline hover:text-foreground transition-colors">
            {T.downloadSimple}
          </button>
        </div>
      </section>

      {/* ── Step 4: When to call ── */}
      <section className="space-y-3 mb-8">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">4. {T.whenToCall}</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSchedule('now')}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              schedule === 'now'
                ? 'border-green-500 bg-green-500/5'
                : 'border-border hover:border-green-500/40',
            )}
          >
            <p className={cn('text-sm font-semibold', schedule === 'now' ? 'text-green-400' : 'text-foreground')}>
              {T.startImmediately}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{T.startImmediatelyDesc}</p>
          </button>
          <button
            onClick={() => setSchedule('later')}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              schedule === 'later'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40',
            )}
          >
            <p className={cn('text-sm font-semibold', schedule === 'later' ? 'text-primary' : 'text-foreground')}>
              {T.scheduleForLater}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{T.scheduleForLaterDesc}</p>
          </button>
        </div>

        {schedule === 'later' && (
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="h-9 text-sm"
          />
        )}
      </section>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className={cn(
            'rounded-lg px-3 py-2 text-sm',
            validCount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-secondary text-muted-foreground',
          )}>
            <p className="font-medium">{validCount > 0 ? `✅ ${T.readyToLaunch}` : `⚠️ ${T.addBookingsToLaunch}`}</p>
            <p className="text-xs opacity-80">
              {validCount} bookings · {bookingDate} {bookingTime}
              {selectedTemplate ? ` · ${selectedTemplate.emoji} ${selectedTemplate.name}` : ''}
            </p>
          </div>
          <Button
            className="w-full"
            onClick={handleLaunch}
            disabled={saving || validCount === 0 || !selectedTemplate}
          >
            {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Launching…</> : T.confirmLaunch}
          </Button>
        </div>
      </div>
    </div>
  );
}
