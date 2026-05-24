import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="calling">Calling</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Twilio</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Account SID</Label>
                <Input disabled placeholder="Set via TWILIO_ACCOUNT_SID env var" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Auth Token</Label>
                <Input disabled type="password" placeholder="Set via TWILIO_AUTH_TOKEN env var" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone Number</Label>
                <Input disabled placeholder="Set via TWILIO_PHONE_NUMBER env var" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">AI Provider</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Gemini API Key</Label>
                <Input disabled type="password" placeholder="Set via GEMINI_API_KEY env var" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Model</Label>
                <Input disabled placeholder={process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calling" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Outbound Campaigns</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Concurrency</Label>
                <Input disabled placeholder={process.env.CAMPAIGN_CONCURRENCY || '3'} />
                <p className="text-xs text-muted-foreground">Set via CAMPAIGN_CONCURRENCY env var (max 5)</p>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Voice Webhook URL</Label>
                <Input disabled placeholder="Set via VOICE_WEBHOOK_URL env var" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Console Base URL</Label>
                <Input disabled placeholder="Set via WEBHOOK_BASE_URL env var" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Environment variables are managed in Zeabur service settings.
      </p>
    </div>
  );
}
