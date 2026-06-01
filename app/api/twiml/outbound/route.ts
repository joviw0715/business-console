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
  const businessName = process.env.BUSINESS_NAME ?? '';

  // Only use structured booking fields — never fall back to free-text note for date/time/party_size
  const rawBookingDate = customData?.date || '';
  const rawBookingTime = customData?.time || '';
  const partySize      = customData?.party_size || customData?.remarks || '';

  // Format ISO date "2026-06-02" → "2026年6月2日" for natural TTS reading
  function formatDateZh(d: string): string {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return d;
    return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`;
  }

  // Format 24h time "19:00" → "下午7時" for natural TTS reading
  function formatTimeZh(t: string): string {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    const h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const period = h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return min === 0 ? `${period}${h12}時` : `${period}${h12}時${min}分`;
  }

  const bookingDate = formatDateZh(rawBookingDate);
  const bookingTime = formatTimeZh(rawBookingTime);

  function interpolate(text: string): string {
    let s = text
      .replace(/\{\{business\}\}/g, businessName)
      .replace(/\{\{name\}\}/g, contact?.name ?? '')
      .replace(/\{\{date\}\}/g, bookingDate)
      .replace(/\{\{time\}\}/g, bookingTime)
      .replace(/\{\{custom_field\}\}/g, customField);

    if (partySize) {
      s = s.replace(/\{\{party_size\}\}/g, partySize);
    } else {
      // Remove "，{{party_size}}位" pattern so greeting stays grammatical
      s = s.replace(/[，,]\s*\{\{party_size\}\}\s*位/g, '');
      s = s.replace(/\{\{party_size\}\}/g, '');
    }
    return s;
  }

  let systemPrompt = interpolate(rawSystemPrompt);
  // If party size is unknown, append an instruction to ask after confirmation
  if (!partySize) {
    systemPrompt += '\n\n如果客人確認訂座但未提及人數，請問：「請問到時會有幾多位？」';
  }

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
