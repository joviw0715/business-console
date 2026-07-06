'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Check, Copy, LogOut, ExternalLink, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';

interface UserTemplate {
  id: number; name: string; emoji: string;
  campaign_name: string | null; greeting_text: string | null; system_prompt: string | null;
  hotline_name: string | null; hotline_system_prompt: string | null; after_hours_message: string | null;
}

interface SettingsData {
  business_name: string;
  wa_outbound_enabled: string;
  wa_inbound_enabled: string;
  pdf_import_enabled: string;
  voice_provider: string;
  wa_provider: string;
  fs_esl_host: string;
  fs_esl_port: number;
  fs_esl_password: string;
  fs_did_number: string;
  meta_wa_token: string;
  meta_wa_phone_number_id: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  business_name: '',
  wa_outbound_enabled: 'false',
  wa_inbound_enabled: 'false',
  pdf_import_enabled: 'false',
  voice_provider: 'twilio',
  wa_provider: 'twilio',
  fs_esl_host: '',
  fs_esl_port: 8021,
  fs_esl_password: '',
  fs_did_number: '',
  meta_wa_token: '',
  meta_wa_phone_number_id: '',
};

function EnvRow({ label, envKey, secret }: { label: string; envKey: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(envKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input disabled type={secret ? 'password' : 'text'} placeholder={`Set via ${envKey}`} className="h-8 text-xs" />
      </div>
      <button onClick={handleCopy} title="Copy env key name" className="mt-5 text-muted-foreground hover:text-foreground transition-colors">
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function TemplatesSection() {
  const { T } = useLang();
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [editing, setEditing] = useState<UserTemplate | null>(null);

  async function load() {
    const res = await fetch('/api/user-templates');
    if (res.ok) setTemplates(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    await fetch(`/api/user-templates/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleSave() {
    if (!editing) return;
    const method = editing.id ? 'PUT' : 'POST';
    const url = editing.id ? `/api/user-templates/${editing.id}` : '/api/user-templates';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    setEditing(null);
    load();
  }

  const blank: UserTemplate = { id: 0, name: '', emoji: '⭐', campaign_name: null, greeting_text: null, system_prompt: null, hotline_name: null, hotline_system_prompt: null, after_hours_message: null };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-16">
            <Label className="text-xs text-muted-foreground">{T.templateEmoji}</Label>
            <Input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} className="h-8 text-center text-lg" maxLength={2} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{T.templateName} *</Label>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8" />
          </div>
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase pt-1">Outbound</p>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Campaign name suggestion</Label>
            <Input value={editing.campaign_name ?? ''} onChange={(e) => setEditing({ ...editing, campaign_name: e.target.value || null })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Greeting text</Label>
            <Input value={editing.greeting_text ?? ''} onChange={(e) => setEditing({ ...editing, greeting_text: e.target.value || null })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">AI script / system prompt</Label>
            <textarea value={editing.system_prompt ?? ''} onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value || null })} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase pt-1">Inbound</p>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Hotline name suggestion</Label>
            <Input value={editing.hotline_name ?? ''} onChange={(e) => setEditing({ ...editing, hotline_name: e.target.value || null })} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hotline system prompt</Label>
            <textarea value={editing.hotline_system_prompt ?? ''} onChange={(e) => setEditing({ ...editing, hotline_system_prompt: e.target.value || null })} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">After-hours message</Label>
            <textarea value={editing.after_hours_message ?? ''} onChange={(e) => setEditing({ ...editing, after_hours_message: e.target.value || null })} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={!editing.name.trim()}>{T.saveTemplate}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>{T.cancel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{T.noUserTemplates}</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-lg w-6 text-center shrink-0">{t.emoji}</span>
              <p className="flex-1 text-sm font-medium">{t.name}</p>
              <button onClick={() => setEditing({ ...t })} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="outline" onClick={() => setEditing({ ...blank })}>
        + {T.saveAsTemplate}
      </Button>
    </div>
  );
}

function ProvidersSection({ config, setConfig }: { config: SettingsData; setConfig: React.Dispatch<React.SetStateAction<SettingsData>> }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_provider:          config.voice_provider,
        wa_provider:             config.wa_provider,
        fs_esl_host:             config.fs_esl_host,
        fs_esl_port:             config.fs_esl_port,
        fs_esl_password:         config.fs_esl_password,
        fs_did_number:           config.fs_did_number,
        meta_wa_token:           config.meta_wa_token,
        meta_wa_phone_number_id: config.meta_wa_phone_number_id,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function RadioGroup({ field, options }: { field: 'voice_provider' | 'wa_provider'; options: { value: string; label: string }[] }) {
    return (
      <div className="flex gap-3 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setConfig((s) => ({ ...s, [field]: o.value }))}
            className={cn(
              'px-3 py-1 rounded-full text-xs border transition-colors',
              config[field] === o.value
                ? 'bg-violet-500 border-violet-500 text-white'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  const showFs   = config.voice_provider === 'freeswitch' || config.voice_provider === 'auto';
  const showMeta = config.wa_provider === 'meta' || config.wa_provider === 'auto';

  return (
    <Section title="通訊提供商">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">語音通話</Label>
          <RadioGroup field="voice_provider" options={[
            { value: 'twilio',      label: 'Twilio' },
            { value: 'freeswitch',  label: 'FreeSWITCH' },
            { value: 'auto',        label: 'Auto (FS → Twilio)' },
          ]} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">WhatsApp 訊息</Label>
          <RadioGroup field="wa_provider" options={[
            { value: 'twilio', label: 'Twilio' },
            { value: 'meta',   label: 'Meta Cloud API' },
            { value: 'auto',   label: 'Auto (Meta → Twilio)' },
          ]} />
        </div>

        {showFs && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">FreeSWITCH ESL</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">ESL Host</Label>
                <Input value={config.fs_esl_host} onChange={(e) => setConfig((s) => ({ ...s, fs_esl_host: e.target.value }))} className="h-8 text-xs" placeholder="127.0.0.1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Port</Label>
                <Input type="number" value={config.fs_esl_port} onChange={(e) => setConfig((s) => ({ ...s, fs_esl_port: Number(e.target.value) }))} className="h-8 text-xs" placeholder="8021" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ESL Password</Label>
              <Input type="password" value={config.fs_esl_password} onChange={(e) => setConfig((s) => ({ ...s, fs_esl_password: e.target.value }))} className="h-8 text-xs" placeholder="ClueCon" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">DID Number (outbound caller ID)</Label>
              <Input value={config.fs_did_number} onChange={(e) => setConfig((s) => ({ ...s, fs_did_number: e.target.value }))} className="h-8 text-xs" placeholder="+85212345678" />
            </div>
          </>
        )}

        {showMeta && (
          <>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">Meta Cloud API</p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Access Token</Label>
              <Input type="password" value={config.meta_wa_token} onChange={(e) => setConfig((s) => ({ ...s, meta_wa_token: e.target.value }))} className="h-8 text-xs" placeholder="EAAxxxxx…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
              <Input value={config.meta_wa_phone_number_id} onChange={(e) => setConfig((s) => ({ ...s, meta_wa_phone_number_id: e.target.value }))} className="h-8 text-xs" placeholder="123456789012345" />
            </div>
            <p className="text-xs text-muted-foreground">
              Meta inbound webhook: <code className="bg-secondary px-1 rounded">/api/webhooks/whatsapp/meta</code>
            </p>
          </>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saved ? <><Check className="h-3.5 w-3.5 mr-1" />✓</> : saving ? '…' : '儲存提供商設定'}
        </Button>
      </div>
    </Section>
  );
}

function WaConfirmationSection({ settings, setSettings }: { settings: SettingsData; setSettings: React.Dispatch<React.SetStateAction<SettingsData>> }) {
  const { T } = useLang();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaving(true);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name:       settings.business_name,
        wa_outbound_enabled: settings.wa_outbound_enabled,
        wa_inbound_enabled:  settings.wa_inbound_enabled,
        pdf_import_enabled:  settings.pdf_import_enabled,
      }),
    }).then((res) => {
      setSaving(false);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }).catch(() => {
      setSaving(false);
    });
  }

  return (
    <Section title={T.sectionWaConfirmation}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{T.waBusinessName}</Label>
          <Input
            value={settings.business_name}
            onChange={(e) => setSettings((s) => ({ ...s, business_name: e.target.value }))}
            placeholder={T.waBusinessNamePlaceholder}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">{T.waBusinessNameHint}</p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{T.waOutboundConfirmation}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{T.waOutboundConfirmationDesc}</p>
          </div>
          <Switch checked={settings.wa_outbound_enabled === 'true'} onCheckedChange={(v) => setSettings((s) => ({ ...s, wa_outbound_enabled: v ? 'true' : 'false' }))} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{T.waInboundConfirmation}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{T.waInboundConfirmationDesc}</p>
          </div>
          <Switch checked={settings.wa_inbound_enabled === 'true'} onCheckedChange={(v) => setSettings((s) => ({ ...s, wa_inbound_enabled: v ? 'true' : 'false' }))} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">匯入 PDF／文字</p>
            <p className="text-xs text-muted-foreground mt-0.5">允許在知識庫中匯入 PDF 或文字檔案</p>
          </div>
          <Switch checked={settings.pdf_import_enabled === 'true'} onCheckedChange={(v) => setSettings((s) => ({ ...s, pdf_import_enabled: v ? 'true' : 'false' }))} />
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saved ? <><Check className="h-3.5 w-3.5 mr-1" />✓</> : saving ? '…' : T.waSaveSettings}
        </Button>
      </div>
    </Section>
  );
}

export default function SettingsClient({ isAdmin, username }: { isAdmin: boolean; username?: string }) {
  const router = useRouter();
  const { T } = useLang();
  const [signingOut, setSigningOut] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data: Partial<SettingsData>) => {
      setSettings({
        business_name:           data.business_name           ?? '',
        wa_outbound_enabled:     data.wa_outbound_enabled     ?? 'false',
        wa_inbound_enabled:      data.wa_inbound_enabled      ?? 'false',
        pdf_import_enabled:      data.pdf_import_enabled      ?? 'false',
        voice_provider:          data.voice_provider          ?? 'twilio',
        wa_provider:             data.wa_provider             ?? 'twilio',
        fs_esl_host:             data.fs_esl_host             ?? '',
        fs_esl_port:             data.fs_esl_port             ?? 8021,
        fs_esl_password:         data.fs_esl_password         ?? '',
        fs_did_number:           data.fs_did_number           ?? '',
        meta_wa_token:           data.meta_wa_token           ?? '',
        meta_wa_phone_number_id: data.meta_wa_phone_number_id ?? '',
      });
    }).catch(() => {});
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-lg font-bold">{T.settingsTitle}</h1>

      {/* My Templates — admin only */}
      {isAdmin && (
        <Section title={T.sectionTemplates}>
          <TemplatesSection />
        </Section>
      )}

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* Twilio */}
          <Section title="Twilio">
            <EnvRow label="Account SID"  envKey="TWILIO_ACCOUNT_SID" />
            <EnvRow label="Auth Token"   envKey="TWILIO_AUTH_TOKEN"  secret />
            <EnvRow label="Phone Number" envKey="TWILIO_PHONE_NUMBER" />
            <p className="text-xs text-muted-foreground pt-1">
              Manage numbers in the{' '}
              <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">
                Twilio console <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
          </Section>

          {/* AI */}
          <Section title={T.sectionAIProvider}>
            <EnvRow label="Gemini API Key" envKey="GEMINI_API_KEY" secret />
            <EnvRow label="Gemini Model"   envKey="GEMINI_MODEL" />
            <Separator />
            <div className="pt-1 space-y-1">
              <p className="text-xs font-medium">{T.directMode}</p>
              <p className="text-xs text-muted-foreground">
                Set <code className="bg-secondary px-1 rounded">USE_GEMINI_DIRECT=true</code> on voice-claw-webhook to bypass OpenClaw and route all queries directly to Gemini.
              </p>
            </div>
          </Section>

          {/* Voice / Webhook wiring */}
          <Section title={T.sectionVoiceWebhook}>
            <EnvRow label="Voice-claw WebSocket URL (wss://…)"    envKey="VOICE_CLAW_WS_URL" />
            <EnvRow label="Console callback URL (this app)"        envKey="WEBHOOK_BASE_URL" />
            <EnvRow label="Console callback on voice-claw-webhook" envKey="CONSOLE_CALLBACK_URL" />
            <div className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground space-y-1 mt-1">
              <p className="font-medium text-foreground">{T.inboundCallSetup}</p>
              <p>Set your Twilio number&apos;s voice webhook to:</p>
              <code className="block bg-card rounded px-2 py-1 select-all">
                https://business-console.zeabur.app/api/twiml/inbound
              </code>
              <p>Outbound calls use <code>/api/twiml/outbound</code> automatically via the campaign worker.</p>
            </div>
          </Section>

          {/* Calling defaults */}
          <Section title={T.sectionCallingDefaults}>
            <EnvRow label="Max concurrency (env override)" envKey="CAMPAIGN_CONCURRENCY" />
            <p className="text-xs text-muted-foreground">
              Per-campaign concurrency is set in the campaign creation wizard (1–5). This env var caps the global maximum.
            </p>
          </Section>

          {/* Provider selection */}
          <ProvidersSection config={settings} setConfig={setSettings} />
        </>
      )}

      {/* WhatsApp Confirmation */}
      <WaConfirmationSection settings={settings} setSettings={setSettings} />

      {/* Account */}
      <Section title={T.sectionAccount}>
        {username && (
          <div className="mb-3 pb-3 border-b border-border">
            <p className="text-xs text-muted-foreground">已登入</p>
            <p className="text-sm font-medium">{username}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{T.signOut}</p>
            <p className="text-xs text-muted-foreground">{T.signOutDesc}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut} className={cn('gap-1.5', signingOut && 'opacity-50')}>
            <LogOut className="h-3.5 w-3.5" />
            {signingOut ? T.signingOut : T.signOut}
          </Button>
        </div>
      </Section>
    </div>
  );
}
