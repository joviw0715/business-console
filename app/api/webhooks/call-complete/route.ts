import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import axios from 'axios';

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
          content: 'Analyse this Cantonese call transcript. Return JSON only: { "summary": "...", "sentiment": "positive|neutral|negative", "outcome": "answered|voicemail|no_answer|busy|failed", "key_points": ["..."] }. Keep summary under 100 words in Traditional Chinese.',
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

  const { summary, sentiment, outcome, key_points } = JSON.parse(match[0]);

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
