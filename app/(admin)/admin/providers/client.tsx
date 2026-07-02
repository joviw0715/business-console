'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Cpu, Mic, Volume2, Settings2 } from 'lucide-react';

interface ProviderConfig {
  llm: string;
  tts: string;
  stt: string;
}

interface Props {
  config: ProviderConfig;
}

const LLM_OPTIONS = [
  { value: 'auto', label: 'Auto (use best available)' },
  { value: 'ctm', label: 'CTM — Qwen' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openclaw', label: 'OpenClaw' },
];

const TTS_OPTIONS = [
  { value: 'auto', label: 'Auto (use best available)' },
  { value: 'ctm', label: 'CTM TTS' },
  { value: 'minimax', label: 'MiniMax' },
];

const STT_OPTIONS = [
  { value: 'auto', label: 'Auto (use best available)' },
  { value: 'ctm', label: 'CTM ASR' },
  { value: 'azure', label: 'Azure Speech' },
];

export default function ProvidersClient({ config: initial }: Props) {
  const router = useRouter();
  const [llm, setLlm] = useState<string>(initial.llm || 'auto');
  const [tts, setTts] = useState<string>(initial.tts || 'auto');
  const [stt, setStt] = useState<string>(initial.stt || 'auto');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm, tts, stt }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save');
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (err) {
      setError('Network error — could not reach voice service');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">AI Provider Settings</h1>
            <p className="text-sm text-muted-foreground">Changes take effect on the next call — no redeploy needed.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/admin')}>
          ← Back
        </Button>
      </div>

      {/* LLM */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Language Model (LLM)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={llm} onValueChange={(v) => v && setLlm(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* TTS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            Text-to-Speech (TTS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={tts} onValueChange={(v) => v && setTts(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* STT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            Speech-to-Text (STT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={stt} onValueChange={(v) => v && setStt(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-green-500 text-sm">
            <CheckCircle2 className="h-4 w-4" /> Saved — takes effect on next call
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
        )}
      </div>
    </div>
  );
}
