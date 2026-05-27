'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Check, Copy, LogOut, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';

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
        <Input
          disabled
          type={secret ? 'password' : 'text'}
          placeholder={`Set via ${envKey}`}
          className="h-8 text-xs"
        />
      </div>
      <button
        onClick={handleCopy}
        title="Copy env key name"
        className="mt-5 text-muted-foreground hover:text-foreground transition-colors"
      >
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

export default function SettingsPage() {
  const router = useRouter();
  const { T } = useLang();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-bold">{T.settingsTitle}</h1>

      {/* Twilio */}
      <Section title="Twilio">
        <EnvRow label="Account SID"  envKey="TWILIO_ACCOUNT_SID" />
        <EnvRow label="Auth Token"   envKey="TWILIO_AUTH_TOKEN"  secret />
        <EnvRow label="Phone Number" envKey="TWILIO_PHONE_NUMBER" />
        <p className="text-xs text-muted-foreground pt-1">
          Manage numbers in the{' '}
          <a
            href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-0.5"
          >
            Twilio console <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
      </Section>

      {/* AI */}
      <Section title="AI Provider">
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
      <Section title="Voice webhook wiring">
        <EnvRow label="Voice-claw WebSocket URL (wss://…)"   envKey="VOICE_CLAW_WS_URL" />
        <EnvRow label="Console callback URL (this app)"       envKey="WEBHOOK_BASE_URL" />
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
      <Section title="Calling defaults">
        <EnvRow label="Max concurrency (env override)" envKey="CAMPAIGN_CONCURRENCY" />
        <p className="text-xs text-muted-foreground">
          Per-campaign concurrency is set in the campaign creation wizard (1–5). This env var caps the global maximum.
        </p>
      </Section>

      {/* Account */}
      <Section title={T.sectionAccount}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{T.signOut}</p>
            <p className="text-xs text-muted-foreground">{T.signOutDesc}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className={cn('gap-1.5', signingOut && 'opacity-50')}
          >
            <LogOut className="h-3.5 w-3.5" />
            {signingOut ? T.signingOut : T.signOut}
          </Button>
        </div>
      </Section>

      <p className="text-xs text-muted-foreground pb-4">{T.envVarsManagedIn}</p>
    </div>
  );
}
