'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, CheckCircle2, AlertCircle, XCircle, LogIn, LogOut,
  Phone, PhoneIncoming, PhoneOutgoing, Shield, MessageCircle, Trash2, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountData {
  id: number; username: string; display_name: string | null; is_admin: boolean; created_at: string;
  twilio_account_sid: string; twilio_auth_token: string; twilio_phone_number: string;
  twilio_whatsapp_number: string; gemini_api_key: string; gemini_model: string;
  voice_webhook_url: string; webhook_base_url: string;
  business_name: string; default_area_code: string;
  wa_outbound_enabled: boolean; wa_inbound_enabled: boolean;
  setup_health: 'ready' | 'partial' | 'not_configured';
  voice_provider: 'twilio' | 'freeswitch' | 'auto';
  fs_esl_host: string; fs_esl_port: number; fs_esl_password: string; fs_did_number: string;
}

interface Hotline { id: number; name: string; twilio_number: string; status: string; live_count: number; total_calls: number; kb_items: number; }
interface Campaign { id: number; name: string; status: string; created_at: string; total_contacts: number; done_contacts: number; answered: number; }
interface InboundStats { total: number; resolved: number; escalated: number; follow_up: number; missed: number; abandoned: number; avg_duration: number; positive: number; negative: number; }
interface OutboundStats { total: number; answered: number; voicemail: number; no_answer: number; failed: number; booking_confirmed: number; avg_duration: number; wa_sent: number; }
interface TrendDay { date: string; inbound: number; outbound: number; }
interface CallHistory { type: 'inbound' | 'outbound'; id: number; call_sid: string; phone: string; started_at: string; duration_sec: number | null; outcome: string | null; sentiment: string | null; summary: string | null; source_name: string; }

interface StatsData {
  account: AccountData; hotlines: Hotline[]; campaigns: Campaign[];
  inbound: InboundStats; outbound: OutboundStats; trend: TrendDay[]; history: CallHistory[]; days: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function SetupDot({ health }: { health: string }) {
  if (health === 'ready') return <span className="flex items-center gap-1 text-green-500 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>;
  if (health === 'partial') return <span className="flex items-center gap-1 text-amber-500 text-xs"><AlertCircle className="h-3.5 w-3.5" /> Partial</span>;
  return <span className="flex items-center gap-1 text-destructive text-xs"><XCircle className="h-3.5 w-3.5" /> Not configured</span>;
}

function ProgressBar({ value, total, color = 'bg-primary' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-muted-foreground">{value} ({pct}%)</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountDetailClient({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState<'twilio' | 'freeswitch' | 'auto'>('twilio');
  const [tab, setTab] = useState<'setup' | 'overview' | 'report' | 'whatsapp'>('setup');
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // WhatsApp admins state
  const [waAdmins, setWaAdmins] = useState<{ id: number; phone: string; name: string | null; created_at: string }[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [showWaForm, setShowWaForm] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waName, setWaName] = useState('');
  const [waError, setWaError] = useState('');
  const [waAdding, setWaAdding] = useState(false);

  async function load(d = days) {
    setLoading(true);
    const res = await fetch(`/api/admin/accounts/${accountId}/stats?days=${d}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setVoiceProvider(json.account.voice_provider ?? 'twilio');
    }
    setLoading(false);
  }

  async function loadWaAdmins() {
    setWaLoading(true);
    const res = await fetch(`/api/admin/accounts/${accountId}/whatsapp-admins`);
    if (res.ok) setWaAdmins(await res.json());
    setWaLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'whatsapp') loadWaAdmins(); }, [tab]);

  async function handleAddWaAdmin(e: React.FormEvent) {
    e.preventDefault();
    setWaAdding(true); setWaError('');
    const res = await fetch(`/api/admin/accounts/${accountId}/whatsapp-admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: waPhone, name: waName }),
    });
    const json = await res.json();
    if (res.ok) {
      setWaAdmins(prev => [...prev, json]);
      setWaPhone(''); setWaName(''); setShowWaForm(false);
    } else {
      setWaError(json.error ?? 'Failed to add');
    }
    setWaAdding(false);
  }

  async function handleDeleteWaAdmin(adminId: number) {
    if (!confirm('Remove this WhatsApp admin?')) return;
    const res = await fetch(`/api/admin/accounts/${accountId}/whatsapp-admins?adminId=${adminId}`, { method: 'DELETE' });
    if (res.ok) setWaAdmins(prev => prev.filter(a => a.id !== adminId));
  }

  async function handleImpersonate() {
    const res = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: parseInt(accountId) }) });
    if (res.ok) router.push('/');
  }

  const [testPhone, setTestPhone] = useState('');
  const [testCalling, setTestCalling] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  async function handleTestCall() {
    if (!testPhone) return;
    setTestCalling(true); setTestMsg('');
    const res = await fetch('/api/admin/test-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, accountId: parseInt(accountId) }),
    });
    const json = await res.json();
    setTestMsg(res.ok ? `Calling… uuid: ${json.callUuid}` : `Error: ${json.error}`);
    setTestCalling(false);
  }

  async function handleSaveVoiceProvider(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    const form = new FormData(e.currentTarget);
    const body: Record<string, string | number> = {
      voice_provider: form.get('voice_provider') as string,
      fs_esl_host:     form.get('fs_esl_host') as string,
      fs_esl_port:     parseInt(form.get('fs_esl_port') as string) || 8021,
      fs_esl_password: form.get('fs_esl_password') as string,
      fs_did_number:   form.get('fs_did_number') as string,
    };
    const res = await fetch(`/api/admin/accounts/${accountId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaveMsg(res.ok ? 'Saved' : 'Error saving');
    setSaving(false);
    if (res.ok) load();
  }

  async function handleSaveCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    ['twilio_account_sid','twilio_auth_token','twilio_phone_number','twilio_whatsapp_number',
     'gemini_api_key','gemini_model','voice_webhook_url','webhook_base_url'].forEach(k => {
      body[k] = form.get(k) as string;
    });
    const res = await fetch(`/api/admin/accounts/${accountId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaveMsg(res.ok ? 'Saved' : 'Error saving');
    setSaving(false);
    if (res.ok) load();
  }

  async function handleSaveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    const form = new FormData(e.currentTarget);
    const body = {
      business_name:       form.get('business_name') as string,
      default_area_code:   form.get('default_area_code') as string,
      wa_outbound_enabled: data?.account.wa_outbound_enabled ?? false,
      wa_inbound_enabled:  data?.account.wa_inbound_enabled ?? false,
    };
    if (form.get('new_password')) {
      Object.assign(body, { password: form.get('new_password') });
    }
    const res = await fetch(`/api/admin/accounts/${accountId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaveMsg(res.ok ? 'Saved' : 'Error saving');
    setSaving(false);
    if (res.ok) load();
  }

  async function toggleWa(field: 'wa_outbound_enabled' | 'wa_inbound_enabled', val: boolean) {
    if (!data) return;
    setData(prev => prev ? { ...prev, account: { ...prev.account, [field]: val } } : prev);
    await fetch(`/api/admin/accounts/${accountId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: val }) });
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>;
  }

  const { account, hotlines, campaigns, inbound, outbound, trend, history } = data;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {account.is_admin ? <Shield className="h-4 w-4 text-amber-500" /> : <span className="text-lg font-semibold">{account.username}</span>}
            {account.display_name && <span className="text-muted-foreground">({account.display_name})</span>}
            <SetupDot health={account.setup_health} />
          </div>
        </div>
        {!account.is_admin && (
          <Button size="sm" variant="outline" onClick={handleImpersonate}>
            <LogIn className="h-4 w-4 mr-1" /> Impersonate
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['setup','overview','report','whatsapp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'px-4 py-2 text-sm capitalize transition-colors flex items-center gap-1.5',
            tab === t ? 'border-b-2 border-primary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}>
            {t === 'whatsapp' && <MessageCircle className="h-3.5 w-3.5" />}
            {t === 'whatsapp' ? 'WhatsApp' : t}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ────────────────────────────────────────────────────── */}
      {tab === 'setup' && (
        <div className="space-y-6">
          {/* Credentials */}
          <Card>
            <CardHeader><CardTitle className="text-base">Credentials</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'twilio_account_sid',     label: 'Twilio Account SID',    type: 'text' },
                    { key: 'twilio_auth_token',       label: 'Twilio Auth Token',     type: 'password' },
                    { key: 'twilio_phone_number',     label: 'Twilio Phone Number',   type: 'text' },
                    { key: 'twilio_whatsapp_number',  label: 'Twilio WhatsApp Number',type: 'text' },
                    { key: 'gemini_api_key',          label: 'Gemini API Key',        type: 'password' },
                    { key: 'gemini_model',            label: 'Gemini Model',          type: 'text' },
                    { key: 'voice_webhook_url',       label: 'Voice Webhook URL',     type: 'text' },
                    { key: 'webhook_base_url',        label: 'Webhook Base URL',      type: 'text' },
                  ].map(({ key, label, type }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <div className="relative">
                        <Input
                          name={key}
                          type={type}
                          defaultValue={account[key as keyof AccountData] as string}
                          placeholder={type === 'password' ? '••••••••' : ''}
                          className={cn('text-sm', account[key as keyof AccountData] ? '' : 'border-amber-500/50')}
                        />
                        {account[key as keyof AccountData]
                          ? <CheckCircle2 className="absolute right-2 top-2.5 h-3.5 w-3.5 text-green-500 pointer-events-none" />
                          : <AlertCircle className="absolute right-2 top-2.5 h-3.5 w-3.5 text-amber-500 pointer-events-none" />
                        }
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Credentials'}</Button>
                  {saveMsg && <span className={cn('text-xs', saveMsg === 'Saved' ? 'text-green-500' : 'text-destructive')}>{saveMsg}</span>}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Voice Provider */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" />Voice Provider</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveVoiceProvider} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Provider</Label>
                  <select
                    name="voice_provider"
                    value={voiceProvider}
                    onChange={e => setVoiceProvider(e.target.value as 'twilio' | 'freeswitch' | 'auto')}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="twilio">Twilio only</option>
                    <option value="freeswitch">FreeSWITCH (SIP trunk) only</option>
                    <option value="auto">Auto (FreeSWITCH → fallback Twilio)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'fs_esl_host',     label: 'FreeSWITCH ESL Host',     type: 'text',     placeholder: '47.237.117.134' },
                    { key: 'fs_esl_port',     label: 'ESL Port',                type: 'number',   placeholder: '8021' },
                    { key: 'fs_esl_password', label: 'ESL Password',            type: 'password', placeholder: '••••••••' },
                    { key: 'fs_did_number',   label: 'DID Number (caller ID)',  type: 'text',     placeholder: '+85212345678' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        name={key}
                        type={type}
                        defaultValue={account[key as keyof AccountData] as string}
                        placeholder={placeholder}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Voice Provider'}</Button>
                  {saveMsg && <span className={cn('text-xs', saveMsg === 'Saved' ? 'text-green-500' : 'text-destructive')}>{saveMsg}</span>}
                </div>
                <div className="border-t pt-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">Test Call (FreeSWITCH)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      placeholder="+85212345678"
                      className="text-sm max-w-[200px]"
                    />
                    <Button type="button" size="sm" variant="outline" disabled={testCalling || !testPhone} onClick={handleTestCall}>
                      <Phone className="h-3.5 w-3.5 mr-1" />
                      {testCalling ? 'Calling…' : 'Call'}
                    </Button>
                  </div>
                  {testMsg && <p className={cn('text-xs', testMsg.startsWith('Error') ? 'text-destructive' : 'text-green-500')}>{testMsg}</p>}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Business Name</Label>
                    <Input name="business_name" defaultValue={account.business_name} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Area Code</Label>
                    <Input name="default_area_code" defaultValue={account.default_area_code} className="text-sm" />
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={account.wa_outbound_enabled} onCheckedChange={(v) => toggleWa('wa_outbound_enabled', v)} />
                    <Label className="text-sm">WA Outbound Confirmation</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={account.wa_inbound_enabled} onCheckedChange={(v) => toggleWa('wa_inbound_enabled', v)} />
                    <Label className="text-sm">WA Inbound Confirmation</Label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">New Password (leave blank to keep current)</Label>
                  <Input name="new_password" type="password" className="text-sm max-w-xs" placeholder="••••••••" />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
                  {saveMsg && <span className={cn('text-xs', saveMsg === 'Saved' ? 'text-green-500' : 'text-destructive')}>{saveMsg}</span>}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Hotlines */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PhoneIncoming className="h-4 w-4 text-violet-400" />Hotlines ({hotlines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {hotlines.length === 0
                ? <p className="text-sm text-muted-foreground px-4 py-6 text-center">No hotlines yet</p>
                : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Number</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Total Calls</th>
                      <th className="px-4 py-2 font-medium">KB Items</th>
                      <th className="px-4 py-2 font-medium">Live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotlines.map(h => (
                      <tr key={h.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2 font-medium">{h.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.twilio_number}</td>
                        <td className="px-4 py-2">
                          <Badge variant={h.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {h.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{h.total_calls}</td>
                        <td className="px-4 py-2">{h.kb_items}</td>
                        <td className="px-4 py-2">{h.live_count > 0 ? <span className="text-green-500 font-medium">{h.live_count}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Campaigns */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PhoneOutgoing className="h-4 w-4 text-primary" />Campaigns ({campaigns.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {campaigns.length === 0
                ? <p className="text-sm text-muted-foreground px-4 py-6 text-center">No campaigns yet</p>
                : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Contacts</th>
                      <th className="px-4 py-2 font-medium">Done</th>
                      <th className="px-4 py-2 font-medium">Answered</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2">
                          <Badge variant={c.status === 'running' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
                        </td>
                        <td className="px-4 py-2">{c.total_contacts}</td>
                        <td className="px-4 py-2">{c.done_contacts}</td>
                        <td className="px-4 py-2">{c.answered}</td>
                        <td className="px-4 py-2 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── REPORT TAB ───────────────────────────────────────────────────── */}
      {tab === 'report' && (
        <div className="space-y-6">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Period:</span>
            {[7, 30, 90].map(d => (
              <Button key={d} size="sm" variant={days === d ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => { setDays(d); load(d); }}>
                {d}d
              </Button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Inbound Calls', value: inbound?.total ?? 0, icon: PhoneIncoming, color: 'text-violet-400' },
              { label: 'Outbound Calls', value: outbound?.total ?? 0, icon: PhoneOutgoing, color: 'text-primary' },
              { label: 'Bookings Confirmed', value: outbound?.booking_confirmed ?? 0, icon: CheckCircle2, color: 'text-green-500' },
              { label: 'WA Confirmations', value: outbound?.wa_sent ?? 0, icon: Phone, color: 'text-blue-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('h-4 w-4', color)} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-2xl font-semibold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PhoneIncoming className="h-4 w-4 text-violet-400" />Inbound Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Resolved',  value: inbound?.resolved ?? 0, color: 'bg-green-500' },
                  { label: 'Escalated', value: inbound?.escalated ?? 0, color: 'bg-amber-500' },
                  { label: 'Follow-up', value: inbound?.follow_up ?? 0, color: 'bg-blue-500' },
                  { label: 'Missed',    value: inbound?.missed ?? 0, color: 'bg-destructive' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-0.5"><span>{label}</span></div>
                    <ProgressBar value={value} total={inbound?.total ?? 0} color={color} />
                  </div>
                ))}
                <div className="pt-2 text-xs text-muted-foreground">Avg duration: {fmtDuration(inbound?.avg_duration ?? 0)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PhoneOutgoing className="h-4 w-4 text-primary" />Outbound Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Answered',   value: outbound?.answered ?? 0, color: 'bg-green-500' },
                  { label: 'No Answer',  value: outbound?.no_answer ?? 0, color: 'bg-muted-foreground' },
                  { label: 'Voicemail',  value: outbound?.voicemail ?? 0, color: 'bg-blue-500' },
                  { label: 'Failed',     value: outbound?.failed ?? 0, color: 'bg-destructive' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-0.5"><span>{label}</span></div>
                    <ProgressBar value={value} total={outbound?.total ?? 0} color={color} />
                  </div>
                ))}
                <div className="pt-2 text-xs text-muted-foreground">Avg duration: {fmtDuration(outbound?.avg_duration ?? 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Daily trend */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Daily Trend</CardTitle></CardHeader>
            <CardContent>
              {trend.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                : (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-24 min-w-max">
                    {(() => {
                      const maxVal = Math.max(...trend.map(d => d.inbound + d.outbound), 1);
                      return trend.map((d) => (
                        <div key={d.date} className="flex flex-col items-center gap-0.5" style={{ width: `${Math.max(600 / trend.length, 16)}px` }}>
                          <div className="flex items-end gap-px w-full justify-center" style={{ height: '72px' }}>
                            <div className="bg-violet-400/70 rounded-t w-2" style={{ height: `${(d.inbound / maxVal) * 72}px` }} title={`Inbound: ${d.inbound}`} />
                            <div className="bg-primary/70 rounded-t w-2" style={{ height: `${(d.outbound / maxVal) * 72}px` }} title={`Outbound: ${d.outbound}`} />
                          </div>
                          <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                            {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-400/70 inline-block" /> Inbound</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-primary/70 inline-block" /> Outbound</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call history */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Call History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {history.length === 0
                ? <p className="text-sm text-muted-foreground px-4 py-6 text-center">No calls yet</p>
                : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Phone</th>
                        <th className="px-4 py-2 font-medium">Source</th>
                        <th className="px-4 py-2 font-medium">Date</th>
                        <th className="px-4 py-2 font-medium">Duration</th>
                        <th className="px-4 py-2 font-medium">Outcome</th>
                        <th className="px-4 py-2 font-medium">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((c) => (
                        <tr key={`${c.type}-${c.id}`} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-2">
                            {c.type === 'inbound'
                              ? <span className="flex items-center gap-1 text-violet-400"><PhoneIncoming className="h-3 w-3" />In</span>
                              : <span className="flex items-center gap-1 text-primary"><PhoneOutgoing className="h-3 w-3" />Out</span>
                            }
                          </td>
                          <td className="px-4 py-2 font-mono">{c.phone}</td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[120px] truncate">{c.source_name}</td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {new Date(c.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-2">{fmtDuration(c.duration_sec)}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-[10px]">{c.outcome ?? '—'}</Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{c.summary ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── WHATSAPP TAB ─────────────────────────────────────────────────── */}
      {tab === 'whatsapp' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    WhatsApp Bot Admins
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone numbers authorised to create campaigns via WhatsApp bot
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setShowWaForm(!showWaForm); setWaError(''); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add Admin
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add form */}
              {showWaForm && (
                <form onSubmit={handleAddWaAdmin} className="flex gap-2 items-end p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Phone (E.164)</Label>
                    <Input
                      value={waPhone}
                      onChange={e => setWaPhone(e.target.value)}
                      placeholder={`${data?.account.default_area_code ?? '+852'}...`}
                      className="text-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Name (optional)</Label>
                    <Input
                      value={waName}
                      onChange={e => setWaName(e.target.value)}
                      placeholder="Display name"
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={waAdding}>
                      {waAdding ? 'Adding…' : 'Add'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowWaForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {waError && <p className="text-xs text-destructive">{waError}</p>}

              {/* Admins list */}
              {waLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : waAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No WhatsApp admins yet. Add a phone number to allow it to control the bot.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Added</th>
                      <th className="px-3 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waAdmins.map(admin => (
                      <tr key={admin.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-3 py-2 font-mono text-sm">{admin.phone}</td>
                        <td className="px-3 py-2 text-muted-foreground">{admin.name ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteWaAdmin(admin.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
