import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import axios from 'axios';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { call_sid, transcript, duration_sec, escalated } = body as {
    call_sid: string; transcript?: string; duration_sec?: number; escalated?: boolean;
  };

  console.log(`[inbound/call-end] sid=${call_sid} duration=${duration_sec}s escalated=${escalated}`);

  try {
    const { rows: [call] } = await pool.query(
      `UPDATE inbound_calls
       SET ended_at = NOW(), duration_sec = $1, transcript = $2, escalated = $3
       WHERE call_sid = $4
       RETURNING id, hotline_id`,
      [duration_sec ?? null, transcript ?? null, escalated ?? false, call_sid],
    );

    if (!call) {
      console.warn(`[inbound/call-end] no record found for sid=${call_sid}`);
      return NextResponse.json({ ok: true });
    }

    if (transcript && process.env.GEMINI_API_KEY) {
      summariseInbound(call.id, transcript, call.hotline_id, escalated ?? false).catch((e) =>
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

async function summariseInbound(callId: number, transcript: string, hotlineId: number, escalated: boolean) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'Analyse this Cantonese inbound call transcript. Return JSON only: { "summary": "...", "sentiment": "positive|neutral|negative", "outcome": "resolved|escalated|missed|abandoned" }. Keep summary under 100 words in Traditional Chinese.',
        },
        { role: 'user', content: transcript },
      ],
      max_tokens: 200,
    },
    {
      headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    },
  );

  const content = res.data.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return;

  const { summary, sentiment, outcome } = JSON.parse(match[0]);
  const finalOutcome = escalated ? 'escalated' : (outcome ?? 'resolved');

  await pool.query(
    `UPDATE inbound_calls SET summary = $1, sentiment = $2, outcome = $3 WHERE id = $4`,
    [summary ?? null, sentiment ?? null, finalOutcome, callId],
  );

  const { rows: [config] } = await pool.query(
    'SELECT webhook_url FROM hotline_config WHERE hotline_id = $1',
    [hotlineId],
  );
  if (config?.webhook_url) {
    await axios.post(config.webhook_url, { call_id: callId, summary, sentiment, outcome: finalOutcome })
      .catch(() => {});
  }
}
