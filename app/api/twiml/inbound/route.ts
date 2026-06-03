import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';

export async function POST(req: Request) {
  const form = await req.formData();
  const toRaw = (form.get('To') as string) ?? '';
  const callSid = form.get('CallSid') as string;
  const callerPhone = (form.get('From') as string | null)?.replace(/^whatsapp:/, '') ?? null;

  const toLast8 = toRaw.replace(/\D/g, '').slice(-8);

  if (!toLast8) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this number is not configured.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const { rows: [hotline] } = await pool.query(`
    SELECT h.id, h.status, h.account_id, hc.system_prompt, hc.voice_id, hc.max_call_duration_sec,
           hc.business_hours, hc.after_hours_message, hc.qdrant_collection
    FROM hotlines h
    JOIN hotline_config hc ON hc.hotline_id = h.id
    WHERE regexp_replace(h.twilio_number, '\\D', '', 'g') LIKE '%' || $1
    ORDER BY (h.status = 'active') DESC, h.id DESC
    LIMIT 1
  `, [toLast8]);

  if (!hotline) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this service is not available.</Say></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  const creds = await getAccountCredentials(hotline.account_id);
  const rawVoiceUrl = creds.voiceWebhookUrl.replace(/\/$/, '');
  const voiceWebhookUrl = rawVoiceUrl.startsWith('http') ? rawVoiceUrl : `https://${rawVoiceUrl}`;
  const webhookHost = new URL(voiceWebhookUrl).host;
  const businessName = creds.businessName;
  const hotlineName = businessName || '我哋';

  const esc = (s: string) => s
    .replace(/[\r\n]/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  function buildStream(greetingText: string, systemPrompt: string, afterHours = false) {
    const qdrantCollection = hotline.qdrant_collection ?? '';
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
      ${qdrantCollection ? `<Parameter name="qdrantCollection" value="${esc(qdrantCollection)}" />` : ''}
    </Stream>
  </Connect>
</Response>`;
  }

  const defaultAfterHoursPrompt = `你係${hotlineName}嘅客服助手。而家係非辦公時間，同事明天返工後會親自跟進。你嘅任務係用廣東話熱情接待來電者，讓佢知道我哋係非辦公時間，但你可以代為記錄。
慢慢逐一收集以下資料，每次只問一個問題，唔好趕：
1. 來電者姓名（點稱呼）
2. 回撥電話（如果號碼顯示係未知就要問，如果已知就確認一下）
3. 查詢或要求的內容（仔細聆聽，可以多問幾句了解清楚）
收集完所有資料後，用溫暖嘅語氣確認已記錄，並保證明天跟進。唔好急於結束通話，如果來電者仲有其他問題或補充，繼續傾聽並記錄。只有當來電者明確表示唔需要再補充，先溫和咁結束通話。`;

  const afterHoursSystemPrompt = hotline.after_hours_message?.trim()
    ? hotline.after_hours_message.trim().replace(/\{\{business\}\}/g, businessName)
    : defaultAfterHoursPrompt;

  const afterHoursGreeting = `你好，歡迎致電${hotlineName}！我哋而家係非辦公時間，不過唔緊要，我可以幫你。請問有咩可以幫到你？`;

  if (hotline.status === 'paused') {
    return new Response(buildStream(afterHoursGreeting, afterHoursSystemPrompt, true), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

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

  const systemPrompt = (hotline.system_prompt ?? '').replace(/\{\{business\}\}/g, businessName);
  const greetingText = `你好，歡迎致電${hotlineName}。請問有咩可以幫到你？`;

  return new Response(buildStream(greetingText, systemPrompt, false), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
