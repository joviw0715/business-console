import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';
import { getAccountCredentials } from '@/lib/credentials';
import { safeCompare } from '@/lib/webhook-auth';

const VALID_OUTBOUND_OUTCOMES = new Set(['answered', 'voicemail', 'no_answer', 'busy', 'failed']);

export async function POST(req: Request) {
  // Verify shared secret from voice-claw-webhook
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!safeCompare(provided, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
    // Store raw report — WHERE NOT EXISTS deduplicates retries without needing a unique constraint
    const { rows: [report] } = await pool.query(
      `INSERT INTO call_reports (contact_id, campaign_id, call_sid, duration_sec, transcript, outcome)
       SELECT $1, $2, $3, $4, $5, 'answered'
       WHERE NOT EXISTS (SELECT 1 FROM call_reports WHERE call_sid = $3)
       RETURNING id`,
      [contact_id, campaign_id, call_sid, duration_sec ?? null, transcript ?? null],
    );
    if (!report) return NextResponse.json({ ok: true, deduped: true });
    console.log(`[call-complete] report ${report.id} created`);

    // Mark contact done
    await pool.query(
      "UPDATE contacts SET status = 'done', outcome = 'answered', duration_sec = $1, transcript = $2 WHERE call_sid = $3",
      [duration_sec ?? null, transcript ?? null, call_sid],
    );

    // Run AI summarisation async (don't block response)
    if (transcript) {
      summarise(report.id, transcript, campaign_id).catch((e) =>
        console.error('[webhook] summarise failed:', e.message),
      );
    }

    // Check if campaign is now complete.
    // Count both 'pending' and 'calling' contacts: a 'calling' contact may still
    // produce a call-complete event, so the campaign isn't done until all active
    // work has also resolved.
    const { rows: [counts] } = await pool.query(
      "SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'calling')) AS active FROM contacts WHERE campaign_id = $1",
      [campaign_id],
    );
    if (parseInt(counts.active) === 0) {
      await pool.query(
        "UPDATE campaigns SET status = 'done', completed_at = NOW() WHERE id = $1 AND status = 'running'",
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
  // Look up account credentials so per-account Gemini keys work in multi-tenant deployments
  const { rows: [campaignRow] } = await pool.query(
    'SELECT account_id FROM campaigns WHERE id = $1',
    [campaignId],
  );
  if (!campaignRow) return;
  const creds = await getAccountCredentials(campaignRow.account_id);
  const apiKey = creds.geminiApiKey;
  const model = creds.geminiModel || 'gemini-2.5-flash-lite';
  if (!apiKey) return; // no key configured for this account

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Analyse this Cantonese call transcript. Return JSON only: { "summary": "...", "sentiment": "positive|neutral|negative", "outcome": "answered|voicemail|no_answer|busy|failed|booking_confirmed", "key_points": ["..."], "booking_date": "YYYY-MM-DD or empty string", "booking_time": "HH:MM (24h) or empty string", "booking_party_size": "number as string or empty string" }. Set outcome to booking_confirmed ONLY if the customer explicitly confirmed a booking/reservation during this call. Extract booking_date/booking_time/booking_party_size from the conversation if mentioned. When extracting booking_date, always use the current year ${new Date().getFullYear()} unless a different year is explicitly stated. Keep summary under 100 words in Traditional Chinese.`,
          },
          { role: 'user', content: transcript },
        ],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  const content = (await res.json()).choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return;

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(match[0]); } catch { return; }
  const summary = parsed.summary as string | undefined;
  const sentiment = parsed.sentiment as string | undefined;
  const outcome = parsed.outcome as string | undefined;
  const key_points = parsed.key_points as string[] | undefined;
  const booking_date = parsed.booking_date as string | undefined;
  const booking_time = parsed.booking_time as string | undefined;
  const booking_party_size = parsed.booking_party_size as string | undefined;

  // contacts.outcome and call_reports.outcome only allow values within the CHECK constraint.
  // 'booking_confirmed' is an AI-extended outcome — map it to 'answered' for DB writes.
  const dbOutcome = outcome ? (VALID_OUTBOUND_OUTCOMES.has(outcome) ? outcome : 'answered') : null;

  await pool.query(
    `UPDATE call_reports SET summary = $1, sentiment = $2, outcome = $3, key_points = $4,
     booking_date = $5, booking_time = $6, booking_party_size = $7 WHERE id = $8`,
    [summary ?? null, sentiment ?? null, dbOutcome, JSON.stringify(key_points ?? []),
     booking_date ?? null, booking_time ?? null, booking_party_size ?? null, reportId],
  );

  if (outcome) {
    await pool.query(
      'UPDATE contacts SET outcome = $1, summary = $2 WHERE id = (SELECT contact_id FROM call_reports WHERE id = $3)',
      [dbOutcome, summary ?? null, reportId],
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
    fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, summary, sentiment, outcome, key_points }),
    }).catch(() => {});
  }
}

async function sendOutboundWaConfirmation(reportId: number, campaignId: number, aiExtracted: { aiDate: string; aiTime: string; aiPeople: string } = { aiDate: '', aiTime: '', aiPeople: '' }) {
  console.log(`[wa-outbound] starting for report=${reportId} campaign=${campaignId}`);

  // Check per-account setting
  const { rows: [accountRow] } = await pool.query(
    'SELECT a.id, a.wa_outbound_enabled, a.business_name FROM accounts a JOIN campaigns c ON c.account_id = a.id WHERE c.id = $1',
    [campaignId],
  );
  console.log(`[wa-outbound] settings: wa_outbound_enabled=${accountRow?.wa_outbound_enabled} business_name="${accountRow?.business_name}"`);
  if (!accountRow?.wa_outbound_enabled) {
    console.log(`[wa-outbound] SKIP — wa_outbound_enabled is not true`);
    return;
  }
  const accountId: number = accountRow.id;

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
  // AI-extracted values take priority — they reflect what was actually discussed in the call
  // (e.g. customer requested a change). Fall back to contact's pre-loaded data.
  const date   = aiExtracted.aiDate   || customData.date        || '';
  const time   = aiExtracted.aiTime   || customData.time        || '';
  const people = aiExtracted.aiPeople || customData.party_size  || customData.remarks || '';
  console.log(`[wa-outbound] booking vars: date="${date}" time="${time}" people="${people}" (ai: ${JSON.stringify(aiExtracted)})`);

  if (!date || !time) {
    console.warn(`[wa-outbound] SKIP — missing date/time for ${row.phone} (people is optional)`);
    return;
  }

  console.log(`[wa-outbound] SENDING to ${row.phone}…`);
  // If AI extracted a different date/time than the original contact data, this is a modification
  const isModified = (aiExtracted.aiDate && customData.date && aiExtracted.aiDate !== customData.date)
    || (aiExtracted.aiTime && customData.time && aiExtracted.aiTime !== customData.time);
  await sendBookingConfirmation(row.phone, {
    restaurant: accountRow.business_name || '餐廳',
    customer:   row.name || '客人',
    status:     isModified ? '已更改' : '已確認',
    date, time, people,
  }, accountId);
  console.log(`[wa-outbound] ✅ sent to ${row.phone}`);

  await pool.query(
    `UPDATE call_reports SET wa_confirmation_sent = true WHERE id = $1`,
    [reportId],
  );
}
