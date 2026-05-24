export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  const voiceWebhookUrl = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');

  // TwiML: connect the outbound call to voice-claw-webhook via Media Stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${new URL(voiceWebhookUrl).host}/stream">
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
