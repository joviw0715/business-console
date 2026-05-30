'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { Suspense } from 'react';
import { useLang } from '@/contexts/lang';

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Jamie', desc: 'Female (Cantonese)' },
  { id: 'Cantonese_BrightBoy',  label: 'Kenji', desc: 'Male (Cantonese)'   },
  { id: 'Cantonese_WarmLady',   label: 'Anna',  desc: 'Female (English)'   },
  { id: 'moss_audio_f7aa082d-5c0a-11f1-a392-62a1f5ede8a7', label: 'Moss', desc: 'Custom' },
];

const DEFAULT_PROMPT = `你係一個專業嘅廣東話AI助手，代表公司聯絡客戶。
請用自然流暢嘅廣東話溝通，態度友善而專業。
唔好每句都叫用戶名字，自然地間中叫一次就夠。
分享資訊時用口語講出嚟，唔好用清單格式。`;

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  custom_field: string;
}

function NewCampaignInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const initialTemplate = searchParams.get('template') ?? '';
  const isUserTpl = initialTemplate.startsWith('user_');
  const userTplId = isUserTpl ? initialTemplate.replace('user_', '') : null;

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);

  const [form, setForm] = useState(() => {
    const tpl = TEMPLATE_LIST.find((t) => t.key === initialTemplate);
    return {
      name: tpl?.sampleCampaignName[lang] ?? '',
      voice_id: 'Cantonese_GentleLady',
      system_prompt: tpl?.sampleScript[lang] ?? DEFAULT_PROMPT,
      greeting_text: tpl?.greetingText ?? '',
      schedule: 'now',
      scheduled_at: '',
      concurrency: '3',
    };
  });

  // Pre-fill from user template if key is user_xxx
  useEffect(() => {
    if (!userTplId) return;
    fetch(`/api/user-templates/${userTplId}`)
      .then((r) => r.json())
      .then((t) => {
        setForm((f) => ({
          ...f,
          name: t.campaign_name ?? f.name,
          system_prompt: t.system_prompt ?? f.system_prompt,
          greeting_text: t.greeting_text ?? f.greeting_text,
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTplId]);

  const [contacts, setContacts] = useState<ContactRow[]>([
    { id: crypto.randomUUID(), name: '', phone: '', custom_field: '' },
  ]);

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function applyTemplate(key: string) {
    const same = selectedTemplate === key;
    setSelectedTemplate(same ? '' : key);
    if (same) return;
    const tpl = TEMPLATE_LIST.find((t) => t.key === key);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      name: tpl.sampleCampaignName[lang],
      system_prompt: tpl.sampleScript[lang],
      greeting_text: tpl.greetingText,
    }));
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n').filter(Boolean);
      if (lines.length < 2) { setError('CSV has no data rows'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const phoneIdx = headers.findIndex((h) => /phone|mobile|tel|number/.test(h));
      const nameIdx  = headers.findIndex((h) => h.includes('name'));
      const noteIdx  = headers.findIndex((h) => /note|custom|time|date|appointment/.test(h));
      if (phoneIdx === -1) { setError('CSV must have a column named "phone", "mobile", or "tel"'); return; }
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        return {
          id: crypto.randomUUID(),
          phone: vals[phoneIdx] ?? '',
          name: nameIdx >= 0 ? (vals[nameIdx] ?? '') : '',
          custom_field: noteIdx >= 0 ? (vals[noteIdx] ?? '') : '',
        };
      }).filter((r) => r.phone.trim());
      if (parsed.length === 0) { setError('No valid rows found'); return; }
      setContacts((rows) => [...rows.filter((r) => r.phone.trim() || r.name.trim()), ...parsed]);
      setError('');
    };
    reader.readAsText(file);
  }

  async function handleImageUpload(file: File) {
    setExtracting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/campaigns/extract-contacts', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Extraction failed'); return; }
      const extracted = (json.contacts as { name: string; phone: string; custom_field: string }[])
        .filter((c) => c.phone.trim())
        .map((c) => ({ id: crypto.randomUUID(), name: c.name, phone: c.phone, custom_field: c.custom_field }));
      if (extracted.length === 0) { setError('No contacts found in image'); return; }
      setContacts((rows) => [...rows.filter((r) => r.phone.trim() || r.name.trim()), ...extracted]);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
    }
  }

  function addContact() {
    setContacts((rows) => [...rows, { id: crypto.randomUUID(), name: '', phone: '', custom_field: '' }]);
  }

  function removeContact(id: string) {
    setContacts((rows) => rows.filter((r) => r.id !== id));
  }

  function updateContact(id: string, field: keyof Omit<ContactRow, 'id'>, val: string) {
    setContacts((rows) => rows.map((r) => r.id === id ? { ...r, [field]: val } : r));
  }

  const validContacts = contacts.filter((c) => c.phone.trim());

  async function handleCreate() {
    if (!form.name.trim()) { setError('Please enter a campaign name'); return; }
    if (validContacts.length === 0) { setError('Please add at least one contact with a phone number'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          concurrency: parseInt(form.concurrency),
          scheduled_at: form.schedule === 'later' ? form.scheduled_at : null,
          contacts: validContacts.map(({ name, phone, custom_field }) => ({ name, phone, custom_field })),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(`Failed (${res.status}): ${text}`);
        setSaving(false);
        return;
      }
      const { id } = await res.json();
      if (form.schedule === 'now') {
        const startRes = await fetch(`/api/campaigns/${id}/start`, { method: 'POST' });
        if (!startRes.ok) console.error('[campaign] start failed:', await startRes.text());
      }
      router.push(`/campaigns/${id}`);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-semibold text-base">New Campaign</h1>
      </div>

      {/* Industry template */}
      <section className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Industry template</Label>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => applyTemplate(t.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                selectedTemplate === t.key
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
              )}
            >
              {t.emoji} {t.name[lang]}
            </button>
          ))}
        </div>
        {selectedTemplate && (
          <p className="text-xs text-muted-foreground">
            {TEMPLATE_LIST.find((t) => t.key === selectedTemplate)?.hint[lang]}
          </p>
        )}
      </section>

      {/* Campaign name */}
      <section className="space-y-2">
        <Label htmlFor="name">Campaign name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Dinner reservation confirmations"
          autoFocus
        />
      </section>

      {/* Contacts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Contacts <span className="text-muted-foreground font-normal">({validContacts.length} with phone)</span></Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {extracting ? 'Extracting…' : 'Image'}
              <input type="file" accept="image/*" className="hidden" disabled={extracting}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
            </label>
            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => csvRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />CSV
            </button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ''; }} />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-px bg-border text-xs font-medium text-muted-foreground px-3 py-2">
            <span>Name</span><span>Phone *</span><span>Note / date</span><span />
          </div>
          <div className="divide-y divide-border">
            {contacts.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-1 px-2 py-1.5 items-center">
                <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="Name"
                  value={row.name} onChange={(e) => updateContact(row.id, 'name', e.target.value)} />
                <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="+852…"
                  value={row.phone} onChange={(e) => updateContact(row.id, 'phone', e.target.value)} />
                <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="e.g. 7pm"
                  value={row.custom_field} onChange={(e) => updateContact(row.id, 'custom_field', e.target.value)} />
                <button type="button" onClick={() => removeContact(row.id)} disabled={contacts.length === 1}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addContact} className="w-full">
          <Plus className="h-4 w-4 mr-1" />Add contact
        </Button>
      </section>

      {/* Voice */}
      <section className="space-y-2">
        <Label>AI Voice</Label>
        <div className="grid grid-cols-3 gap-2">
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setField('voice_id', v.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                form.voice_id === v.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40 text-foreground',
              )}
            >
              <p className="text-sm font-medium">{v.label}</p>
              <p className="text-xs text-muted-foreground">{v.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Script */}
      <section className="space-y-2">
        <Label htmlFor="prompt">AI script</Label>
        <Textarea
          id="prompt"
          value={form.system_prompt}
          onChange={(e) => setField('system_prompt', e.target.value)}
          rows={6}
          placeholder="Hi, this is {{business}}…"
        />
        <p className="text-xs text-muted-foreground">
          Use{' '}
          <code className="bg-secondary px-1 rounded">{'{{name}}'}</code>,{' '}
          <code className="bg-secondary px-1 rounded">{'{{date}}'}</code>,{' '}
          <code className="bg-secondary px-1 rounded">{'{{time}}'}</code>,{' '}
          <code className="bg-secondary px-1 rounded">{'{{party_size}}'}</code>{' '}
          to personalise each call.
        </p>
      </section>

      {/* Schedule */}
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>When to call?</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'now',   label: 'Start immediately', desc: 'Calls begin right after launch' },
              { value: 'later', label: 'Schedule for later', desc: 'Pick a date and time' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('schedule', opt.value)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  form.schedule === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <p className={cn('text-sm font-medium', form.schedule === opt.value && 'text-primary')}>{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {form.schedule === 'later' && (
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setField('scheduled_at', e.target.value)} />
          )}
        </div>

        <div className="space-y-2">
          <Label>Simultaneous calls: <span className="text-primary font-semibold">{form.concurrency}</span></Label>
          <input type="range" min={1} max={5} value={form.concurrency}
            onChange={(e) => setField('concurrency', e.target.value)} className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span><span>2</span><span>3</span><span>4</span><span>5 (max)</span>
          </div>
        </div>
      </section>

      {/* Summary + launch */}
      <section className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-sm font-semibold">Ready to launch</p>
          <p className="text-xs text-muted-foreground">
            {validContacts.length} contact{validContacts.length !== 1 ? 's' : ''}
            {' · '}{form.schedule === 'now' ? 'starts immediately' : form.scheduled_at || 'scheduled'}
            {' · '}{VOICES.find((v) => v.id === form.voice_id)?.label}
            {' · '}{form.concurrency} concurrent
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => router.push('/')}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleCreate} disabled={saving}>
            {saving ? 'Launching…' : 'Launch campaign'}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense>
      <NewCampaignInner />
    </Suspense>
  );
}
