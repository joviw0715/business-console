'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

const STEPS = ['Basic Info', 'Voice Config', 'AI Prompt', 'Schedule'];

const DEFAULT_PROMPT = `你係一個專業嘅廣東話AI助手，代表公司聯絡客戶。
請用自然流暢嘅廣東話溝通，態度友善而專業。
唔好每句都叫用戶名字，自然地間中叫一次就夠。
分享資訊時用口語講出嚟，唔好用清單格式。`;

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    max_retries: '2',
    call_timeout_sec: '60',
    voice_id: 'Cantonese_GentleLady',
    greeting_text: '你好，我係AI助手，請問而家方便傾兩句嗎？',
    system_prompt: DEFAULT_PROMPT,
    schedule: 'now',
    scheduled_at: '',
    concurrency: '3',
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleCreate() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_retries: parseInt(form.max_retries),
          call_timeout_sec: parseInt(form.call_timeout_sec),
          scheduled_at: form.schedule === 'later' ? form.scheduled_at : null,
        }),
      });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/campaigns/${id}`);
      } else {
        const text = await res.text();
        setError(`Failed to create campaign (${res.status}): ${text}`);
        setSaving(false);
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="cursor-pointer hover:text-foreground" onClick={() => router.push('/campaigns')}>
          Campaigns
        </span>
        <span>/</span>
        <span className="text-foreground">New Campaign</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold
              ${i < step ? 'bg-primary text-primary-foreground' :
                i === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                'bg-secondary text-muted-foreground'}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Q2 Outreach" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retries">Max Retries</Label>
                  <Select value={form.max_retries} onValueChange={(v) => set('max_retries', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['0','1','2','3'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Call Timeout (sec)</Label>
                  <Input id="timeout" type="number" value={form.call_timeout_sec} onChange={(e) => set('call_timeout_sec', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select value={form.voice_id} onValueChange={(v) => set('voice_id', v ?? '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cantonese_GentleLady">Cantonese – Gentle Lady</SelectItem>
                    <SelectItem value="Cantonese_BrightBoy">Cantonese – Bright Boy</SelectItem>
                    <SelectItem value="Cantonese_WarmLady">Cantonese – Warm Lady</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Text</Label>
                <Textarea
                  id="greeting"
                  value={form.greeting_text}
                  onChange={(e) => set('greeting_text', e.target.value)}
                  rows={3}
                  placeholder="First thing the AI says when the call connects…"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                value={form.system_prompt}
                onChange={(e) => set('system_prompt', e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" type="button" onClick={() => set('system_prompt', DEFAULT_PROMPT)}>
                Reset to default
              </Button>
            </div>
          )}

          {step === 3 && (
            <>
              <RadioGroup value={form.schedule} onValueChange={(v) => set('schedule', v)} className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now">Start immediately after contacts are imported</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="later" id="later" />
                  <Label htmlFor="later">Schedule for later</Label>
                </div>
              </RadioGroup>
              {form.schedule === 'later' && (
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
              )}
              <div className="space-y-2">
                <Label>Concurrency (simultaneous calls)</Label>
                <Select value={form.concurrency} onValueChange={(v) => set('concurrency', v ?? '')}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5'].map((v) => (
                      <SelectItem key={v} value={v}>{v}{v === '5' ? ' (max)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step === 0 ? router.push('/campaigns') : setStep((s) => s - 1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.name.trim()}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Campaign'}
          </Button>
        )}
      </div>
    </div>
  );
}
