'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEMPLATE_LIST } from '@/lib/industry-templates';
import { useLang } from '@/contexts/lang';

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Jamie', desc: 'Female (Cantonese)' },
  { id: 'Cantonese_BrightBoy',  label: 'Kenji', desc: 'Male (Cantonese)'   },
  { id: 'Cantonese_WarmLady',   label: 'Anna',  desc: 'Female (English)'   },
];

export default function NewHotlinePage() {
  const router = useRouter();
  const { T, lang } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [form, setForm] = useState({
    name: '',
    twilio_number: '',
    voice_id: 'Cantonese_GentleLady',
    system_prompt: '',
    after_hours_message: '',
    open_time: '09:00',
    close_time: '18:00',
  });

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function applyTemplate(key: string) {
    setSelectedTemplate(key);
    const tpl = TEMPLATE_LIST.find((t) => t.key === key);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      name: f.name || tpl.hotlineName[lang],
      system_prompt: tpl.hotlineSystemPrompt[lang],
      after_hours_message: tpl.afterHoursMessage[lang],
    }));
  }

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const business_hours = Object.fromEntries(
        days.map((d) => [d, { enabled: d !== 'sunday', open: form.open_time, close: form.close_time }]),
      );

      const res = await fetch('/api/hotlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          twilio_number: form.twilio_number,
          voice_id: form.voice_id,
          system_prompt: form.system_prompt,
          after_hours_message: form.after_hours_message,
          business_hours,
        }),
      });

      if (res.ok) {
        const { id } = await res.json();
        router.push(`/hotlines/${id}`);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button className="hover:text-foreground" onClick={() => router.push('/inbound')}>{T.inbound}</button>
        <span>/</span>
        <span className="text-foreground">{T.newHotline}</span>
      </div>

      <h1 className="text-lg font-semibold">{T.createInboundHotline}</h1>

      <div>
        <p className="text-xs text-muted-foreground font-medium tracking-wide mb-2">{T.industryTemplate}</p>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => applyTemplate(t.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                selectedTemplate === t.key
                  ? 'border-violet-500 bg-violet-500/10 text-violet-400 font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-violet-500/40',
              )}
            >
              {t.emoji} {t.name[lang]}
            </button>
          ))}
        </div>
        {selectedTemplate && (
          <p className="text-xs text-muted-foreground mt-1">
            {TEMPLATE_LIST.find((t) => t.key === selectedTemplate)?.hint[lang]}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">{T.hotlineName}</Label>
            <Input id="name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={T.hotlineNamePlaceholder} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">{T.twilioNumber}</Label>
            <Input id="number" value={form.twilio_number} onChange={(e) => setField('twilio_number', e.target.value)} placeholder="+85212345678" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{T.voice}</Label>
          <div className="grid grid-cols-3 gap-3">
            {VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setField('voice_id', v.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  form.voice_id === v.id
                    ? 'border-violet-500 bg-violet-500/5 text-violet-400'
                    : 'border-border hover:border-violet-500/40 text-muted-foreground hover:text-foreground',
                )}
              >
                <p className="text-sm font-medium leading-tight">{v.label}</p>
                <p className="text-xs mt-0.5 opacity-70">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">{T.systemPrompt}</Label>
          <Textarea
            id="prompt"
            value={form.system_prompt}
            onChange={(e) => setField('system_prompt', e.target.value)}
            rows={6}
            className="font-mono text-sm"
            placeholder="You are a helpful AI assistant…"
          />
        </div>

        <div className="space-y-2">
          <Label>{T.businessHours}</Label>
          <div className="flex items-center gap-3">
            <Input type="time" value={form.open_time} onChange={(e) => setField('open_time', e.target.value)} className="w-32" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="time" value={form.close_time} onChange={(e) => setField('close_time', e.target.value)} className="w-32" />
          </div>
          <p className="text-xs text-muted-foreground">{T.businessHoursHint}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="after_hours">{T.afterHoursMessage}</Label>
          <Textarea
            id="after_hours"
            value={form.after_hours_message}
            onChange={(e) => setField('after_hours_message', e.target.value)}
            rows={3}
            placeholder="您好，我們現在已關門…"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push('/inbound')}>
          <ArrowLeft className="h-4 w-4 mr-1" />{T.cancel}
        </Button>
        <Button
          onClick={handleCreate}
          disabled={saving || !form.name.trim() || !form.twilio_number.trim()}
          className="min-w-36"
        >
          {saving ? T.creating : T.createHotline}
        </Button>
      </div>
    </div>
  );
}
