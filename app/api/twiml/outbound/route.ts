import pool from '@/lib/db';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  const raw = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  const voiceWebhookUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  const webhookHost = new URL(voiceWebhookUrl).host;

  // Look up voice + greeting from campaign config
  const { rows: [config] } = await pool.query(
    'SELECT voice_id, greeting_text FROM campaign_config WHERE campaign_id = $1',
    [campaignId],
  );
  const voiceId = config?.voice_id ?? 'Cantonese_GentleLady';
  const greetingText = config?.greeting_text ?? '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${webhookHost}/stream">
      <Parameter name="contactId" value="${contactId}" />
      <Parameter name="campaignId" value="${campaignId}" />
      <Parameter name="direction" value="outbound" />
      <Parameter name="voiceId" value="${voiceId}" />
      <Parameter name="greetingText" value="${greetingText.replace(/"/g, '&quot;')}" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
