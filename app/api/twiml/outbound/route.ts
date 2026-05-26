export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  const raw = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  // Ensure protocol present so new URL() doesn't throw
  const voiceWebhookUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  const webhookHost = new URL(voiceWebhookUrl).host;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${webhookHost}/stream">
      <Parameter name="contactId" value="${contactId}" />
      <Parameter name="campaignId" value="${campaignId}" />
      <Parameter name="direction" value="outbound" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
