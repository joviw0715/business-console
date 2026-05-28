import pool from '@/lib/db';

// Twilio sends form-encoded data
export async function POST(req: Request) {
  const form = await req.formData();
  const to = form.get('To') as string;
  const callSid = form.get('CallSid') as string;

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

  if (hotline.status === 'paused') {
    const msg = hotline.after_hours_message || 'Sorry, this service is currently unavailable. Please call back later.';
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="zh-HK">${msg}</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  // Check business hours (HK time, UTC+8)
  const hours = hotline.business_hours as Record<string, { open: string; close: string; enabled: boolean }>;
  if (Object.keys(hours).length > 0) {
    const hkNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayNames[hkNow.getDay()];
    const dayConfig = hours[dayKey];

    if (dayConfig && !dayConfig.enabled) {
      const msg = hotline.after_hours_message || '您好，我們今天休息。請於工作日再來電，謝謝。';
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="zh-HK">${msg}</Say></Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }

    if (dayConfig?.open && dayConfig?.close) {
      const [openH, openM] = dayConfig.open.split(':').map(Number);
      const [closeH, closeM] = dayConfig.close.split(':').map(Number);
      const nowMinutes = hkNow.getHours() * 60 + hkNow.getMinutes();
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (nowMinutes < openMinutes || nowMinutes >= closeMinutes) {
        const msg = hotline.after_hours_message || '您好，我們現在已關門，請於營業時間內再來電，謝謝。';
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="zh-HK">${msg}</Say></Response>`,
          { headers: { 'Content-Type': 'text/xml' } },
        );
      }
    }
  }

  const rawVoiceUrl = (process.env.VOICE_WEBHOOK_URL ?? '').replace(/\/$/, '');
  const voiceWebhookUrl = rawVoiceUrl.startsWith('http') ? rawVoiceUrl : `https://${rawVoiceUrl}`;
  const webhookHost = new URL(voiceWebhookUrl).host;
  const businessName = process.env.BUSINESS_NAME ?? '';

  // Substitute {{business}} in system prompt
  const esc = (s: string) => s.replace(/[\r\n]/g, ' ').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const systemPrompt = (hotline.system_prompt ?? '').replace(/\{\{business\}\}/g, businessName);

  // Derive a natural inbound greeting: "你好，歡迎致電<business>。請問有咩可以幫到你？"
  // If the system prompt contains a <Say>-style opener phrase, use that; otherwise build a generic one.
  const hotlineName = businessName || '我哋';
  const greetingText = `你好，歡迎致電${hotlineName}。請問有咩可以幫到你？`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${webhookHost}/stream">
      <Parameter name="hotlineId" value="${hotline.id}" />
      <Parameter name="direction" value="inbound" />
      <Parameter name="callSid" value="${esc(callSid ?? '')}" />
      <Parameter name="voiceId" value="${esc(hotline.voice_id ?? 'Cantonese_GentleLady')}" />
      <Parameter name="greetingText" value="${esc(greetingText)}" />
      <Parameter name="systemPrompt" value="${esc(systemPrompt)}" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
