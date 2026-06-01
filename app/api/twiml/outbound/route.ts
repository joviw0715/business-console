import pool from '@/lib/db';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  const raw = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  const voiceWebhookUrl = raw.startsWith('http') ? raw : `https://${raw}`;
  const webhookHost = new URL(voiceWebhookUrl).host;

  // Fetch campaign config + contact details in parallel
  const [configResult, contactResult] = await Promise.all([
    pool.query(
      'SELECT voice_id, greeting_text, system_prompt FROM campaign_config WHERE campaign_id = $1',
      [campaignId],
    ),
    pool.query(
      'SELECT name, phone, custom_data FROM contacts WHERE id = $1',
      [contactId],
    ),
  ]);

  const config = configResult.rows[0];
  const contact = contactResult.rows[0];

  const voiceId = config?.voice_id ?? 'Cantonese_GentleLady';
  const rawSystemPrompt = config?.system_prompt ?? '';

  // Build template variable substitution map
  const rawCustomData = contact?.custom_data as Record<string, string> | null ?? {};
  // Handle nested legacy format: { field: "{\"date\":...}" }
  let customData: Record<string, string> = rawCustomData;
  if (rawCustomData.field && typeof rawCustomData.field === 'string') {
    try { customData = { ...rawCustomData, ...JSON.parse(rawCustomData.field) }; } catch { /* ignore */ }
  }
  const customField = customData?.note ?? '';
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
  const businessName = process.env.BUSINESS_NAME ?? '';

  // Prefer structured fields stored by the new campaign page
  const bookingDate = customData?.date ?? (customField || dateStr);
  const bookingTime = customData?.time ?? timeStr;
  const partySize   = customData?.party_size ?? customData?.remarks ?? customField ?? '';

  function interpolate(text: string): string {
    return text
      .replace(/\{\{business\}\}/g, businessName)
      .replace(/\{\{name\}\}/g, contact?.name ?? '')
      .replace(/\{\{date\}\}/g, bookingDate)
      .replace(/\{\{time\}\}/g, bookingTime)
      .replace(/\{\{party_size\}\}/g, partySize)
      .replace(/\{\{custom_field\}\}/g, customField);
  }

  const systemPrompt = interpolate(rawSystemPrompt);

  // Derive greeting: if greeting_text is set use it; otherwise take the opening
  // sentence(s) up to and including the first question mark (？) from the script.
  // This ensures the full opening line is spoken immediately without LLM latency.
  let greetingText = interpolate(config?.greeting_text ?? '');
  if (!greetingText && systemPrompt) {
    // Match everything up to and including the first ？ (Cantonese question)
    const m = systemPrompt.match(/^([\s\S]*?[？?])/);
    greetingText = m ? m[1].trim() : systemPrompt.split(/[。！\n]/)[0].trim();
  }

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
