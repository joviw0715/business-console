import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import axios from 'axios';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.error('[call-complete] invalid JSON body');
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { call_sid, transcript, duration_sec, contact_id, campaign_id } = body as {
    call_sid: string; transcript?: string; duration_sec?: number;
    contact_id: number; campaign_id: number;
  };
  console.log(`[call-complete] received contact=${contact_id} campaign=${campaign_id} sid=${call_sid} duration=${duration_sec}s`);

  try {
    // Store raw report first
    const { rows: [report] } = await pool.query(
      `INSERT INTO call_reports (contact_id, campaign_id, call_sid, duration_sec, transcript, outcome)
       VALUES ($1, $2, $3, $4, $5, 'answered') RETURNING id`,
      [contact_id, campaign_id, call_sid, duration_sec ?? null, transcript ?? null],
    );
    console.log(`[call-complete] report ${report.id} created`);

    // Mark contact done
    await pool.query(
      "UPDATE contacts SET status = 'done', outcome = 'answered', duration_sec = $1, transcript = $2 WHERE call_sid = $3",
      [duration_sec ?? null, transcript ?? null, call_sid],
    );

    // Run AI summarisation async (don't block response)
    if (transcript && process.env.GEMINI_API_KEY) {
      summarise(report.id, transcript, campaign_id).catch((e) =>
        console.error('[webhook] summarise failed:', e.message),
      );
    }

    // Check if campaign is now complete
    const { rows: [counts] } = await pool.query(
      "SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending FROM contacts WHERE campaign_id = $1",
      [campaign_id],
    );
    if (parseInt(counts.pending) === 0) {
      await pool.query(
        "UPDATE campaigns SET status = 'done', completed_at = NOW() WHERE id = $1",
        [campaign_id],
      );
      console.log(`[call-complete] campaign ${campaign_id} marked done`);
    }

    return NextResponse.json({ ok: true, report_id: report.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[call-complete] DB error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function summarise(reportId: number, transcript: string, campaignId: number) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'Analyse this Cantonese call transcript. Return JSON only: { "summary": "...", "sentiment": "positive|neutral|negative", "outcome": "answered|voicemail|no_answer|busy|failed|booking_confirmed", "key_points": ["..."], "booking_date": "YYYY-MM-DD or empty string", "booking_time": "HH:MM (24h) or empty string", "booking_party_size": "number as string or empty string" }. Set outcome to booking_confirmed ONLY if the customer explicitly confirmed a booking/reservation during this call. Extract booking_date/booking_time/booking_party_size from the conversation if mentioned. Keep summary under 100 words in Traditional Chinese.',
        },
        { role: 'user', content: transcript },
      ],
      max_tokens: 300,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    },
  );

  const content = res.data.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return;

  const { summary, sentiment, outcome, key_points, booking_date, booking_time, booking_party_size } = JSON.parse(match[0]);

  await pool.query(
    `UPDATE call_reports SET summary = $1, sentiment = $2, outcome = $3, key_points = $4 WHERE id = $5`,
    [summary ?? null, sentiment ?? null, outcome ?? null, JSON.stringify(key_points ?? []), reportId],
  );

  if (outcome) {
    await pool.query(
      'UPDATE contacts SET outcome = $1, summary = $2 WHERE id = (SELECT contact_id FROM call_reports WHERE id = $3)',
      [outcome, summary ?? null, reportId],
    );
  }

  // WhatsApp booking confirmation
  console.log(`[call-complete] AI outcome="${outcome}" reportId=${reportId}`);
  if (outcome === 'booking_confirmed') {
    console.log(`[call-complete] ✅ booking_confirmed — triggering WA confirmation for report ${reportId}`);
    await sendOutboundWaConfirmation(reportId, campaignId, {
      aiDate: booking_date || '',
      aiTime: booking_time || '',
      aiPeople: booking_party_size || '',
    }).catch((e: Error) =>
      console.error('[call-complete] WA confirmation failed:', e.message, e.stack),
    );
  } else {
    console.log(`[call-complete] outcome="${outcome}" — WA confirmation not triggered`);
  }

  // Deliver to campaign webhook if configured
  const { rows: [config] } = await pool.query(
    'SELECT webhook_url FROM campaign_config WHERE campaign_id = $1',
    [campaignId],
  );
  if (config?.webhook_url) {
    await axios.post(config.webhook_url, { report_id: reportId, summary, sentiment, outcome, key_points })
      .catch(() => {});
  }
}

async function sendOutboundWaConfirmation(reportId: number, campaignId: number, aiExtracted: { aiDate: string; aiTime: string; aiPeople: string } = { aiDate: '', aiTime: '', aiPeople: '' }) {
  console.log(`[wa-outbound] starting for report=${reportId} campaign=${campaignId}`);

  // Check global setting and business name
  const { rows: settingRows } = await pool.query(
    `SELECT key, value FROM app_settings WHERE key IN ('wa_outbound_enabled', 'business_name', 'wa_template_sid')`,
  );
  const s = Object.fromEntries(settingRows.map((r: { key: string; value: string }) => [r.key, r.value]));
  console.log(`[wa-outbound] settings: wa_outbound_enabled=${s['wa_outbound_enabled']} business_name="${s['business_name']}"`);
  if (s['wa_outbound_enabled'] !== 'true') {
    console.log(`[wa-outbound] SKIP — wa_outbound_enabled is not true`);
    return;
  }

  // Check per-template setting via campaign_template_id on campaign
  const { rows: [cRow] } = await pool.query(`
    SELECT ct.wa_confirmation_enabled, c.campaign_template_id
    FROM campaigns c
    LEFT JOIN campaign_templates ct ON ct.id = c.campaign_template_id
    WHERE c.id = $1
  `, [campaignId]);
  console.log(`[wa-outbound] campaign template check: campaign_template_id=${cRow?.campaign_template_id} wa_confirmation_enabled=${cRow?.wa_confirmation_enabled}`);
  if (!cRow?.wa_confirmation_enabled) {
    console.log(`[wa-outbound] SKIP — template wa_confirmation_enabled is not true`);
    return;
  }

  // Pull contact details from this report
  const { rows: [row] } = await pool.query(`
    SELECT ct.phone, ct.name, ct.custom_data
    FROM call_reports cr
    JOIN contacts ct ON ct.id = cr.contact_id
    WHERE cr.id = $1
  `, [reportId]);
  console.log(`[wa-outbound] contact: phone=${row?.phone} name="${row?.name}" custom_data=${JSON.stringify(row?.custom_data)}`);
  if (!row?.phone) {
    console.log(`[wa-outbound] SKIP — no phone`);
    return;
  }

  const rawCustomData = row.custom_data as Record<string, string> | null ?? {};
  // Handle both flat format { date, time, party_size } and legacy nested { field: "{...}" }
  let customData: Record<string, string> = rawCustomData;
  if (rawCustomData.field && typeof rawCustomData.field === 'string') {
    try { customData = { ...rawCustomData, ...JSON.parse(rawCustomData.field) }; } catch { /* ignore */ }
  }
  const date   = customData.date        || aiExtracted.aiDate   || '';
  const time   = customData.time        || aiExtracted.aiTime   || '';
  const people = customData.party_size  || customData.remarks   || aiExtracted.aiPeople || '';
  console.log(`[wa-outbound] booking vars: date="${date}" time="${time}" people="${people}"`);

  if (!date || !time) {
    console.warn(`[wa-outbound] SKIP — missing date/time for ${row.phone} (people is optional)`);
    return;
  }

  console.log(`[wa-outbound] SENDING to ${row.phone}…`);
  await sendBookingConfirmation(row.phone, {
    restaurant: s['business_name'] || '餐廳',
    customer:   row.name || '客人',
    status:     '已確認',
    date, time, people,
    templateSid: s['wa_template_sid'] || undefined,
  });
  console.log(`[wa-outbound] ✅ sent to ${row.phone}`);

  await pool.query(
    `UPDATE call_reports SET wa_confirmation_sent = true WHERE id = $1`,
    [reportId],
  );
}
