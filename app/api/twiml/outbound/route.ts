import pool from '@/lib/db';
import { getAccountCredentials } from '@/lib/credentials';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contactId = url.searchParams.get('contactId');
  const campaignId = url.searchParams.get('campaignId');

  // Resolve account from campaign
  const { rows: [campaign] } = await pool.query(
    'SELECT account_id FROM campaigns WHERE id = $1',
    [campaignId],
  );
  const accountId = campaign?.account_id;
  const creds = accountId ? await getAccountCredentials(accountId) : null;

  const rawVoiceUrl = (creds?.voiceWebhookUrl || process.env.VOICE_WEBHOOK_URL || '').replace(/\/$/, '');
  const voiceWebhookUrl = rawVoiceUrl.startsWith('http') ? rawVoiceUrl : `https://${rawVoiceUrl}`;
  const webhookHost = new URL(voiceWebhookUrl).host;
  const businessName = creds?.businessName || process.env.BUSINESS_NAME || '';

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

  const rawCustomData = contact?.custom_data as Record<string, string> | null ?? {};
  let customData: Record<string, string> = rawCustomData;
  if (rawCustomData.field && typeof rawCustomData.field === 'string') {
    try { customData = { ...rawCustomData, ...JSON.parse(rawCustomData.field) }; } catch { /* ignore */ }
  }
  const customField = customData?.note ?? '';
  const rawBookingDate = customData?.date || '';
  const rawBookingTime = customData?.time || '';
  const partySize = customData?.party_size || customData?.remarks || '';

  function formatDateZh(d: string): string {
    // ISO format: 2026-06-07 → 六月七日
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${parseInt(iso[2])}月${parseInt(iso[3])}日`;

    // "jun 7", "jun7", "7 jun", "June 7" etc.
    const MONTHS: Record<string, number> = {
      jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
      january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
    };
    const mStr = d.toLowerCase().replace(/[.,]/g, '').trim();
    const mMonth = mStr.match(/([a-z]+)\s*(\d{1,2})/);
    if (mMonth && MONTHS[mMonth[1]]) return `${MONTHS[mMonth[1]]}月${parseInt(mMonth[2])}日`;
    const mDay = mStr.match(/(\d{1,2})\s*([a-z]+)/);
    if (mDay && MONTHS[mDay[2]]) return `${MONTHS[mDay[2]]}月${parseInt(mDay[1])}日`;

    return d; // fallback: return as-is
  }

  function formatTimeZh(t: string): string {
    // 24h format: 19:00 → 晚上7時
    const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      const h = parseInt(m24[1]), min = parseInt(m24[2]);
      const period = h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return min === 0 ? `${period}${h12}時` : `${period}${h12}時${min}分`;
    }
    // Informal: "7pm", "7:30pm", "7 pm"
    const mAmPm = t.toLowerCase().replace(/\s/g, '').match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (mAmPm) {
      let h = parseInt(mAmPm[1]);
      const min = mAmPm[2] ? parseInt(mAmPm[2]) : 0;
      const isPm = mAmPm[3] === 'pm';
      if (isPm && h !== 12) h += 12;
      if (!isPm && h === 12) h = 0;
      const period = h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return min === 0 ? `${period}${h12}時` : `${period}${h12}時${min}分`;
    }
    return t; // fallback
  }

  const bookingDate = rawBookingDate ? formatDateZh(rawBookingDate) : customField;
  const bookingTime = rawBookingTime ? formatTimeZh(rawBookingTime) : '';

  function interpolate(text: string): string {
    let s = text
      .replace(/\{\{business\}\}/g, businessName)
      .replace(/\{\{name\}\}/g, contact?.name ?? '')
      // Replace {{date}}{{time}} together with a space between to avoid "jun 77pm"
      .replace(/\{\{date\}\}\{\{time\}\}/g, `${bookingDate} ${bookingTime}`.trim())
      .replace(/\{\{date\}\}/g, bookingDate)
      .replace(/\{\{time\}\}/g, bookingTime)
      .replace(/\{\{custom_field\}\}/g, customField);
    if (partySize) {
      s = s.replace(/\{\{party_size\}\}/g, partySize);
    } else {
      s = s.replace(/[，,]\s*\{\{party_size\}\}\s*位/g, '');
      s = s.replace(/\{\{party_size\}\}/g, '');
    }
    return s;
  }

  const hkNow = new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

  let systemPrompt = interpolate(rawSystemPrompt) + `\n現在香港時間：${hkNow}`;
  if (!partySize) {
    systemPrompt += '\n\n如果客人確認訂座但未提及人數，請問：「請問到時會有幾多位？」';
  }

  let greetingText = interpolate(config?.greeting_text ?? '');
  if (!greetingText && systemPrompt) {
    const m = systemPrompt.match(/^([\s\S]*?[？?])/);
    greetingText = m ? m[1].trim() : systemPrompt.split(/[。！\n]/)[0].trim();
  }

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

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
