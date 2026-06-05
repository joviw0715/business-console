'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';
import { TEMPLATE_LIST, TEMPLATES } from '@/lib/industry-templates';

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Jamie', desc: 'F · Cant.' },
  { id: 'Cantonese_BrightBoy',  label: 'Kenji', desc: 'M · Cant.' },
  { id: 'Cantonese_WarmLady',   label: 'Anna',  desc: 'F · En.'   },
  { id: 'moss_audio_6b759cbc-5c17-11f1-af91-92eea1bed9bb', label: 'Moss',       desc: 'Custom' },
  { id: 'moss_audio_eb6bf7b8-5c1b-11f1-8f84-faf87dcc54b3', label: 'Test Voice', desc: 'Custom' },
];

interface CampaignTemplate {
  id: number;
  name: string;
  emoji: string;
  industry: string | null;
  voice_id: string;
  script: string;
  greeting: string;
  is_builtin: boolean;
  wa_confirmation_enabled: boolean;
}

const BLANK: Omit<CampaignTemplate, 'id' | 'is_builtin'> = {
  name: '', emoji: '📋', industry: null, voice_id: 'Cantonese_GentleLady', script: '', greeting: '', wa_confirmation_enabled: false,
};

export default function ManageTemplatesPage() {
  const router = useRouter();
  const { T, lang } = useLang();
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [editing, setEditing] = useState<(Omit<CampaignTemplate, 'id' | 'is_builtin'> & { id?: number }) | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/campaign-templates');
    if (res.ok) setTemplates(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    const method = editing.id ? 'PUT' : 'POST';
    const url = editing.id ? `/api/campaign-templates/${editing.id}` : '/api/campaign-templates';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm(T.confirmDeleteTemplate)) return;
    await fetch(`/api/campaign-templates/${id}`, { method: 'DELETE' });
    load();
  }

  if (editing !== null) {
    return (
      <div className="max-w-lg mx-auto space-y-5 pb-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setEditing(null)} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {T.manageTemplates}
          </button>
        </div>
        <h1 className="text-lg font-bold">{editing.id ? T.editTemplate2 : T.newTemplate}</h1>

        {/* Name + emoji */}
        <div className="flex gap-2">
          <div className="w-16">
            <Label className="text-xs text-muted-foreground">{T.templateEmoji}</Label>
            <Input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} className="h-9 text-center text-lg" maxLength={2} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{T.templateName} *</Label>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9" placeholder="e.g. Restaurant — weekends" />
          </div>
        </div>

        {/* Industry */}
        <div>
          <Label className="text-xs text-muted-foreground">{T.templateIndustry}</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TEMPLATE_LIST.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  const newIndustry = editing.industry === t.key ? null : t.key;
                  const tpl = newIndustry ? TEMPLATES[newIndustry] : null;
                  setEditing({
                    ...editing,
                    industry: newIndustry,
                    greeting: tpl ? (tpl.sampleGreeting[lang] ?? tpl.greetingText) : editing.greeting,
                    script:   tpl ? (tpl.sampleScript[lang]   ?? tpl.systemPrompt) : editing.script,
                  });
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  editing.industry === t.key
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {t.emoji} {t.name[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* Voice */}
        <div>
          <Label className="text-xs text-muted-foreground">{T.templateVoice}</Label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setEditing({ ...editing, voice_id: v.id })}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-colors',
                  editing.voice_id === v.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <p className="text-xs font-medium">{v.label}</p>
                <p className="text-[10px] opacity-60">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Greeting */}
        <div>
          <Label className="text-xs text-muted-foreground">{T.templateGreeting}</Label>
          <Input
            value={editing.greeting}
            onChange={(e) => setEditing({ ...editing, greeting: e.target.value })}
            className="h-9 text-sm mt-1.5"
            placeholder={lang === 'zh' ? '您好，我係{{business}}嘅Jamie…' : 'Hi, this is Jamie from {{business}}…'}
          />
        </div>

        {/* Script */}
        <div>
          <Label className="text-xs text-muted-foreground">{T.templateScript}</Label>
          <Textarea
            value={editing.script}
            onChange={(e) => setEditing({ ...editing, script: e.target.value })}
            rows={6}
            className="font-mono text-sm mt-1.5"
            placeholder={lang === 'zh' ? '你係{{business}}嘅預約確認助理…' : 'You are Jamie from {{business}}…'}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use: <code className="bg-secondary px-1 rounded">{'{{name}}'}</code>{' '}
            <code className="bg-secondary px-1 rounded">{'{{date}}'}</code>{' '}
            <code className="bg-secondary px-1 rounded">{'{{time}}'}</code>{' '}
            <code className="bg-secondary px-1 rounded">{'{{party_size}}'}</code>{' '}
            <code className="bg-secondary px-1 rounded">{'{{business}}'}</code>
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{T.waEnableOnTemplate}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{T.waEnableOnTemplateDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ ...editing, wa_confirmation_enabled: !editing.wa_confirmation_enabled })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
              editing.wa_confirmation_enabled ? 'bg-violet-500' : 'bg-secondary',
            )}
          >
            <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform', editing.wa_confirmation_enabled ? 'translate-x-4' : 'translate-x-0')} />
          </button>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !editing.name.trim()}>
            {saving ? '…' : T.saveTemplate}
          </Button>
          <Button variant="outline" onClick={() => setEditing(null)}>{T.cancel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> {T.back}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{T.manageTemplates}</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        {T.manageTemplatesDesc}
      </p>

      <Button onClick={() => setEditing({ ...BLANK })} className="w-full">
        <Plus className="h-4 w-4 mr-1.5" />{T.newTemplate}
      </Button>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{t.emoji}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      t.is_builtin ? 'bg-secondary text-muted-foreground' : 'bg-violet-500/10 text-violet-400',
                    )}>
                      {t.is_builtin ? T.builtIn : T.custom}
                    </span>
                  </div>
                  {t.industry && (
                    <p className="text-xs text-muted-foreground">
                      {TEMPLATE_LIST.find((tl) => tl.key === t.industry)?.name[lang] ?? t.industry} ·{' '}
                      {VOICES.find((v) => v.id === t.voice_id)?.label ?? t.voice_id}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditing({ id: t.id, name: t.name, emoji: t.emoji, industry: t.industry, voice_id: t.voice_id, script: t.script, greeting: t.greeting, wa_confirmation_enabled: t.wa_confirmation_enabled ?? false })}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {t.script && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{t.script}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
