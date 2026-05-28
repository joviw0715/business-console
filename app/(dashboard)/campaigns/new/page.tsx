'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { Suspense } from 'react';
import { useLang } from '@/contexts/lang';

const STEPS = ['Details', 'Contacts', 'Voice & Script', 'Schedule'];

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Jamie', desc: 'Female (Cantonese)' },
  { id: 'Cantonese_BrightBoy',  label: 'Kenji', desc: 'Male (Cantonese)'   },
  { id: 'Cantonese_WarmLady',   label: 'Anna',  desc: 'Female (English)'   },
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

// Per-template sample contact labels shown in the hint line
const SAMPLE_LABELS: Record<string, Record<'en' | 'zh' | 'pt', string>> = {
  restaurant:     { en: 'guests',      zh: '客人',   pt: 'convidados'   },
  beauty_salon:   { en: 'clients',     zh: '客戶',   pt: 'clientes'     },
  insurance:      { en: 'policyholders', zh: '保單持有人', pt: 'segurados' },
  travel_agency:  { en: 'travellers',  zh: '旅客',   pt: 'viajantes'    },
  medical_clinic: { en: 'patients',    zh: '病人',   pt: 'pacientes'    },
  real_estate:    { en: 'leads',       zh: '潛在客戶', pt: 'leads'       },
};

function NewCampaignInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { T, lang } = useLang();
  const initialTemplate = searchParams.get('template') ?? '';

  const [step, setStep] = useState(0);
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
      schedule: 'now',
      scheduled_at: '',
      concurrency: '3',
    };
  });

  const [contacts, setContacts] = useState<ContactRow[]>([
    { id: crypto.randomUUID(), name: '', phone: '', custom_field: '' },
  ]);

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function applyTemplate(key: string) {
    setSelectedTemplate(key);
    const tpl = TEMPLATE_LIST.find((t) => t.key === key);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      name: f.name || tpl.sampleCampaignName[lang],
      system_prompt: tpl.sampleScript[lang],
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
      if (parsed.length === 0) { setError('No valid rows with phone numbers found'); return; }
      setContacts((rows) => {
        const nonEmpty = rows.filter((r) => r.phone.trim() || r.name.trim());
        return [...nonEmpty, ...parsed];
      });
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
      setContacts((rows) => {
        const empty = rows.filter((r) => !r.phone.trim() && !r.name.trim());
        return [...rows.filter((r) => r.phone.trim() || r.name.trim()), ...extracted,
          ...(empty.length === rows.length ? [] : [])];
      });
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
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          greeting_text: '',
          concurrency: parseInt(form.concurrency),
          scheduled_at: form.schedule === 'later' ? form.scheduled_at : null,
          contacts: validContacts.map(({ name, phone, custom_field }) => ({ name, phone, custom_field })),
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/campaigns/${id}`);
      } else {
        const text = await res.text();
        setError(`Failed (${res.status}): ${text}`);
        setSaving(false);
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  }

  const canNext =
    (step === 0 && form.name.trim().length > 0) ||
    (step === 1) ||
    (step === 2 && form.system_prompt.trim().length > 0) ||
    step === 3;

  const activeTpl = TEMPLATE_LIST.find((t) => t.key === selectedTemplate);
  const sampleLabel = selectedTemplate
    ? (SAMPLE_LABELS[selectedTemplate]?.[lang] ?? 'contacts')
    : 'contacts';
  const hintLine = activeTpl
    ? T.sampleContacts(sampleLabel)
    : T.switchToAutoFill;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step === 0 ? router.push('/') : setStep((s) => s - 1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-semibold text-base">New Campaign</h1>
      </div>

      {/* Step progress bar */}
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-secondary',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>

      {/* Step 1 — Details */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium mb-2">Industry template</p>
            <div className="flex gap-2 flex-wrap mb-1">
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
              <p className="text-xs text-muted-foreground">{hintLine}</p>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold">Campaign details</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Campaign name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Q2 Outreach"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Step 2 — Contacts */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Contacts ({validContacts.length} with phone number)</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {extracting ? 'Extracting…' : 'Import image'}
                <input type="file" accept="image/*" className="hidden" disabled={extracting} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
              </label>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => csvRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />Import CSV
              </button>
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ''; }} />
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-px bg-border text-xs font-medium text-muted-foreground px-3 py-2">
              <span>Name</span><span>Phone *</span><span>Custom field</span><span />
            </div>
            <div className="divide-y divide-border">
              {contacts.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-1 px-2 py-1.5 items-center">
                  <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="Name" value={row.name} onChange={(e) => updateContact(row.id, 'name', e.target.value)} />
                  <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="+852..." value={row.phone} onChange={(e) => updateContact(row.id, 'phone', e.target.value)} />
                  <Input className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1" placeholder="e.g. date" value={row.custom_field} onChange={(e) => updateContact(row.id, 'custom_field', e.target.value)} />
                  <button type="button" onClick={() => removeContact(row.id)} disabled={contacts.length === 1} className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addContact} className="w-full">
            <Plus className="h-4 w-4 mr-1" />Add contact
          </Button>

          <p className="text-xs text-muted-foreground">
            Use <code className="bg-secondary px-1 rounded">{'{{name}}'}</code>,{' '}
            <code className="bg-secondary px-1 rounded">{'{{date}}'}</code>,{' '}
            <code className="bg-secondary px-1 rounded">{'{{time}}'}</code> in the script to personalise each call.
          </p>
        </div>
      )}

      {/* Step 3 — Voice & Script */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold">AI voice &amp; script</h2>

          <div className="space-y-2">
            <Label>Voice</Label>
            <div className="space-y-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setField('voice_id', v.id)}
                  className={cn(
                    'w-full rounded-lg border p-4 text-left transition-colors',
                    form.voice_id === v.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40 text-foreground',
                  )}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className="text-sm text-muted-foreground"> · {v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">What should the AI say?</Label>
            <Textarea
              id="prompt"
              value={form.system_prompt}
              onChange={(e) => setField('system_prompt', e.target.value)}
              rows={7}
              placeholder="Hi, this is {{business}}…"
            />
            <p className="text-xs text-muted-foreground">
              Use{' '}
              <code className="bg-secondary px-1 rounded">{'{{date}}'}</code>,{' '}
              <code className="bg-secondary px-1 rounded">{'{{time}}'}</code>,{' '}
              <code className="bg-secondary px-1 rounded">{'{{party_size}}'}</code>.
            </p>
          </div>
        </div>
      )}

      {/* Step 4 — Schedule */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>When to call?</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'now',   label: 'Start immediately',   desc: 'Calls begin as soon as you launch' },
                { value: 'later', label: 'Schedule for later',  desc: 'Pick a specific date and time' },
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
            <input type="range" min={1} max={5} value={form.concurrency} onChange={(e) => setField('concurrency', e.target.value)} className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5 (max)</span>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <p className="text-sm font-semibold">Ready to launch</p>
            <p className="text-xs text-muted-foreground">
              {validContacts.length} contact{validContacts.length !== 1 ? 's' : ''}
              {' · '}{form.schedule === 'now' ? 'starts immediately' : form.scheduled_at || 'scheduled'}
              {' · '}{VOICES.find((v) => v.id === form.voice_id)?.label}
              {' · '}{form.concurrency} concurrent
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between gap-3">
        <Button variant="outline" className="flex-1" onClick={() => step === 0 ? router.push('/') : setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button className="flex-1" onClick={handleCreate} disabled={saving}>
            {saving ? 'Launching…' : 'Launch campaign'}
          </Button>
        )}
      </div>
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
