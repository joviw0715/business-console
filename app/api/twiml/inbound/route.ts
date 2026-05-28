import pool from '@/lib/db';

// Twilio sends form-encoded data
export async function POST(req: Request) {
  const form = await req.formData();
  const to = form.get('To') as string;
  const callSid = form.get('CallSid') as string;
  const callerPhone = (form.get('From') as string | null)?.replace(/^whatsapp:/, '') ?? null;

  if (!to) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const { rows: [hotline] } = await pool.query(`
    SELECT h.id, h.status, hc.system_prompt, hc.voice_id, hc.max_call_duration_sec,
           hc.business_hours, hc.after_hours_message
    FROM hotlines h
    JOIN hotline_config hc ON hc.hotline_id = h.id
    WHERE h.twilio_number = $1
    ORDER BY (h.status = 'active') DESC, h.id DESC
    LIMIT 1
  `, [to]);

  if (!hotline) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this service is not available.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const rawVoiceUrl = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  const voiceWebhookUrl = rawVoiceUrl.startsWith('http') ? rawVoiceUrl : `https://${rawVoiceUrl}`;
  const webhookHost = new URL(voiceWebhookUrl).host;
  const businessName = process.env.BUSINESS_NAME ?? '';
  const hotlineName = businessName || '我哋';

  const esc = (s: string) => s
    .replace(/[\r\n]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  function buildStream(greetingText: string, systemPrompt: string, afterHours = false) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${webhookHost}/stream">
      <Parameter name="hotlineId" value="${hotline.id}" />
      <Parameter name="direction" value="inbound" />
      <Parameter name="callSid" value="${esc(callSid ?? '')}" />
      <Parameter name="callerPhone" value="${esc(callerPhone ?? '')}" />
      <Parameter name="voiceId" value="${esc(hotline.voice_id ?? 'Cantonese_GentleLady')}" />
      <Parameter name="greetingText" value="${esc(greetingText)}" />
      <Parameter name="systemPrompt" value="${esc(systemPrompt)}" />
      <Parameter name="afterHours" value="${afterHours ? 'true' : 'false'}" />
    </Stream>
  </Connect>
</Response>`;
  }

  // After-hours system prompt: take a message and name for follow-up
  const afterHoursSystemPrompt = `你係${hotlineName}嘅自動留言助手。而家係非辦公時間。用廣東話有禮貌地通知來電者我哋暫時關門，然後請佢留低：1) 姓名 2) 聯絡電話 3) 查詢事項。用口語、一句一句咁問，唔好長篇大論。收集完資料後確認已記錄，並告知我哋會盡快跟進，然後有禮貌地結束通話。`;
  const afterHoursGreeting = hotline.after_hours_message?.trim()
    ? hotline.after_hours_message.trim()
    : `你好，歡迎致電${hotlineName}。我哋而家係非辦公時間，請問可以留低你嘅姓名同查詢，我哋會盡快聯絡你？`;

  // Paused hotline → after-hours message-taking agent
  if (hotline.status === 'paused') {
    return new Response(buildStream(afterHoursGreeting, afterHoursSystemPrompt, true), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Check business hours (HK time, UTC+8)
  const hours = hotline.business_hours as Record<string, { open: string; close: string; enabled: boolean }>;
  let isAfterHours = false;

  if (Object.keys(hours).length > 0) {
    const hkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayNames[hkNow.getDay()];
    const dayConfig = hours[dayKey];

    if (dayConfig && !dayConfig.enabled) {
      isAfterHours = true;
    } else if (dayConfig?.open && dayConfig?.close) {
      const [openH, openM] = dayConfig.open.split(':').map(Number);
      const [closeH, closeM] = dayConfig.close.split(':').map(Number);
      const nowMinutes = hkNow.getHours() * 60 + hkNow.getMinutes();
      if (nowMinutes < openH * 60 + openM || nowMinutes >= closeH * 60 + closeM) {
        isAfterHours = true;
      }
    }
  }

  if (isAfterHours) {
    return new Response(buildStream(afterHoursGreeting, afterHoursSystemPrompt, true), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Business hours — connect with hotline's own system prompt
  const systemPrompt = (hotline.system_prompt ?? '').replace(/\{\{business\}\}/g, businessName);
  const greetingText = `你好，歡迎致電${hotlineName}。請問有咩可以幫到你？`;

  return new Response(buildStream(greetingText, systemPrompt, false), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
