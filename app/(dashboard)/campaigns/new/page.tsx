'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { Suspense } from 'react';

const STEPS = ['Details', 'Contacts', 'Voice & Script', 'Schedule'];

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Gentle Lady', desc: 'Warm female voice' },
  { id: 'Cantonese_BrightBoy', label: 'Bright Boy', desc: 'Energetic male voice' },
  { id: 'Cantonese_WarmLady', label: 'Warm Lady', desc: 'Friendly female voice' },
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
  const initialTemplate = searchParams.get('template') ?? '';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);

  const [form, setForm] = useState(() => {
    const tpl = TEMPLATE_LIST.find((t) => t.key === initialTemplate);
    return {
      name: '',
      voice_id: 'Cantonese_GentleLady',
      greeting_text: tpl?.greetingText ?? '你好，我係AI助手，請問而家方便傾兩句嗎？',
      system_prompt: tpl?.systemPrompt ?? DEFAULT_PROMPT,
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
    setForm((f) => ({ ...f, greeting_text: tpl.greetingText, system_prompt: tpl.systemPrompt }));
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

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button className="hover:text-foreground" onClick={() => router.push('/campaigns')}>Campaigns</button>
        <span>/</span>
        <span className="text-foreground">New Campaign</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              'flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold shrink-0',
              i < step && 'bg-primary text-primary-foreground',
              i === step && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
              i > step && 'bg-secondary text-muted-foreground',
            )}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={cn('text-xs', i === step ? 'font-medium' : 'text-muted-foreground')}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Details */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs text-muted-foreground font-medium tracking-wide mb-2">INDUSTRY TEMPLATE</p>
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
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Campaign name *</Label>
            <Input id="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Q2 Outreach" autoFocus />
          </div>
        </div>
      )}

      {/* Step 2 — Contacts */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Contacts ({validContacts.length} with phone number)</Label>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors',
              )}
              onClick={() => router.push(`/campaigns/new/import`)}
            >
              <Upload className="h-3.5 w-3.5" />Import CSV
            </button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-px bg-border text-xs font-medium text-muted-foreground px-3 py-2">
              <span>Name</span><span>Phone *</span><span>Custom field</span><span />
            </div>
            <div className="divide-y divide-border">
              {contacts.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-1 px-2 py-1.5 items-center">
                  <Input
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) => updateContact(row.id, 'name', e.target.value)}
                  />
                  <Input
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="+852..."
                    value={row.phone}
                    onChange={(e) => updateContact(row.id, 'phone', e.target.value)}
                  />
                  <Input
                    className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-1"
                    placeholder="e.g. date, product"
                    value={row.custom_field}
                    onChange={(e) => updateContact(row.id, 'custom_field', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(row.id)}
                    disabled={contacts.length === 1}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                  >
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
          <div className="space-y-2">
            <Label>Voice</Label>
            <div className="grid grid-cols-3 gap-3">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setField('voice_id', v.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    form.voice_id === v.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <p className="text-sm font-medium leading-tight">{v.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting <span className="text-muted-foreground text-xs">(first thing the AI says)</span></Label>
            <Textarea
              id="greeting"
              value={form.greeting_text}
              onChange={(e) => setField('greeting_text', e.target.value)}
              rows={3}
              placeholder="你好，我係AI助手…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">What should the AI do?</Label>
            <Textarea
              id="prompt"
              value={form.system_prompt}
              onChange={(e) => setField('system_prompt', e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setField('system_prompt', DEFAULT_PROMPT)}
            >
              Reset to default
            </button>
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
                { value: 'now', label: 'Start immediately', desc: 'Calls begin as soon as you launch' },
                { value: 'later', label: 'Schedule for later', desc: 'Pick a specific date and time' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField('schedule', opt.value)}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors',
                    form.schedule === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <p className={cn('text-sm font-medium', form.schedule === opt.value && 'text-primary')}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {form.schedule === 'later' && (
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setField('scheduled_at', e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Simultaneous calls: <span className="text-primary font-semibold">{form.concurrency}</span></Label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.concurrency}
              onChange={(e) => setField('concurrency', e.target.value)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5 (max)</span>
            </div>
          </div>

          {/* Summary card */}
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

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step === 0 ? router.push('/campaigns') : setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving} className="min-w-36">
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
