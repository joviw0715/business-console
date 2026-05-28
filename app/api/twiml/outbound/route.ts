import pool from '@/lib/db';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  const raw = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  const voiceWebhookUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  const webhookHost = new URL(voiceWebhookUrl).host;

  // Look up voice, greeting and system prompt from campaign config
  const { rows: [config] } = await pool.query(
    'SELECT voice_id, greeting_text, system_prompt FROM campaign_config WHERE campaign_id = $1',
    [campaignId],
  );
  const voiceId = config?.voice_id ?? 'Cantonese_GentleLady';
  const greetingText = config?.greeting_text ?? '';
  const systemPrompt = config?.system_prompt ?? '';

  // Escape XML attribute values
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${webhookHost}/stream">
      <Parameter name="contactId" value="${esc(contactId ?? '')}" />
      <Parameter name="campaignId" value="${esc(campaignId ?? '')}" />
      <Parameter name="direction" value="outbound" />
      <Parameter name="voiceId" value="${esc(voiceId)}" />
      <Parameter name="greetingText" value="${esc(greetingText)}" />
      <Parameter name="systemPrompt" value="${esc(systemPrompt)}" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
