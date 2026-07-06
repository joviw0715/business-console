import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendBookingConfirmation } from '@/lib/wa-confirmation';
import { getAccountCredentials } from '@/lib/credentials';
import { safeCompare } from '@/lib/webhook-auth';

export async function POST(req: Request) {
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
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { call_sid, transcript, duration_sec, escalated, after_hours } = body as {
    call_sid: string; transcript?: string; duration_sec?: number; escalated?: boolean; after_hours?: boolean;
  };

  console.log(`[inbound/call-end] sid=${call_sid} duration=${duration_sec}s escalated=${escalated}`);

  try {
    const { rows: [call] } = await pool.query(
      `UPDATE inbound_calls ic
       SET ended_at = NOW(), duration_sec = $1, transcript = $2, escalated = $3, after_hours = $4
       FROM hotlines h
       WHERE ic.call_sid = $5 AND h.id = ic.hotline_id
       RETURNING ic.id, ic.hotline_id, h.account_id`,
      [duration_sec ?? null, transcript ?? null, escalated ?? false, after_hours ?? false, call_sid],
    );

    if (!call) {
      console.warn(`[inbound/call-end] no record found for sid=${call_sid}`);
      return NextResponse.json({ ok: true });
    }

    if (transcript) {
      summariseInbound(call.id, transcript, call.hotline_id, call.account_id, escalated ?? false, after_hours ?? false).catch((e) =>
        console.error('[inbound/call-end] summarise failed:', e.message),
      );
    }

    return NextResponse.json({ ok: true, id: call.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[inbound/call-end] DB error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function summariseInbound(callId: number, transcript: string, hotlineId: number, accountId: number, escalated: boolean, afterHours: boolean) {
  const creds = await getAccountCredentials(accountId);
  const apiKey = creds.geminiApiKey;
  const model = creds.geminiModel || 'gemini-2.5-flash-lite';
  if (!apiKey) return; // no key configured for this account
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Analyse this Cantonese inbound call transcript. Return JSON only: { "summary": "...", "sentiment": "positive|neutral|negative", "outcome": "resolved|escalated|missed|abandoned|follow_up|booking_confirmed", "booking": { "customer": "", "date": "", "time": "", "people": "" } }. Only set outcome to booking_confirmed if the agent explicitly told the caller their booking IS confirmed (e.g. "已確認", "幫你訂低", "預約成功"). Set outcome to follow_up if: the agent said staff will contact the caller, the agent said they cannot check availability immediately, the agent collected caller details for follow-up, or the agent said "轉交職員", "同事會聯絡", "稍後回覆", "跟進" or similar. Set outcome to resolved only if the caller\'s question was fully answered without needing any staff follow-up. Keep summary under 100 words in Traditional Chinese.',
          },
          { role: 'user', content: transcript },
        ],
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );

  const content = (await res.json()).choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return;

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(match[0]); } catch { return; }
  const { summary, sentiment, outcome, booking } = parsed;
  const finalOutcome = afterHours ? 'follow_up' : escalated ? 'escalated' : (outcome === 'booking_confirmed' ? 'resolved' : (outcome ?? 'resolved'));

  await pool.query(
    `UPDATE inbound_calls SET summary = $1, sentiment = $2, outcome = $3, booking_details = $4 WHERE id = $5`,
    [summary ?? null, sentiment ?? null, finalOutcome, booking ? JSON.stringify(booking) : null, callId],
  );

  // Send WhatsApp booking confirmation for inbound
  if (outcome === 'booking_confirmed') {
    sendInboundWaConfirmation(callId, booking).catch((e: Error) =>
      console.error('[inbound/call-end] WA confirmation failed:', e.message),
    );
  }

  const { rows: [config] } = await pool.query(
    'SELECT webhook_url FROM hotline_config WHERE hotline_id = $1',
    [hotlineId],
  );
  if (config?.webhook_url) {
    fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, summary, sentiment, outcome: finalOutcome }),
    }).catch(() => {});
  }
}

async function sendInboundWaConfirmation(
  callId: number,
  booking: { customer?: string; date?: string; time?: string; people?: string } | null,
) {
  // Check global + per-hotline settings
  const hotlineRows = await pool.query(`SELECT hc.wa_confirmation_enabled, hc.hotline_id, h.account_id FROM hotline_config hc JOIN inbound_calls ic ON ic.hotline_id = hc.hotline_id JOIN hotlines h ON h.id = hc.hotline_id WHERE ic.id = $1 LIMIT 1`, [callId]);
  const hc = hotlineRows.rows[0];
  if (!hc?.wa_confirmation_enabled) return;
  const accountId: number = hc.account_id;

  // Read per-account settings
  const { rows: [account] } = await pool.query(
    'SELECT wa_inbound_enabled, business_name FROM accounts WHERE id = $1',
    [accountId],
  );
  if (!account?.wa_inbound_enabled) return;

  // Get caller phone
  const { rows: [call] } = await pool.query(`SELECT caller_phone FROM inbound_calls WHERE id = $1`, [callId]);
  if (!call?.caller_phone) {
    console.warn(`[inbound/call-end] WA confirmation skipped — no caller phone for call ${callId}`);
    return;
  }

  if (!booking?.date || !booking?.time) {
    console.warn(`[inbound/call-end] WA confirmation skipped — missing date/time for call ${callId}`);
    await pool.query(`UPDATE inbound_calls SET follow_up_status = 'pending' WHERE id = $1`, [callId]);
    return;
  }

  await sendBookingConfirmation(call.caller_phone, {
    restaurant: account.business_name || '餐廳',
    customer:   booking.customer || '客人',
    status:     '確認',
    date:       booking.date,
    time:       booking.time,
    people:     booking.people || '-',
  }, accountId);

  await pool.query(`UPDATE inbound_calls SET wa_confirmation_sent = true WHERE id = $1`, [callId]);
}
