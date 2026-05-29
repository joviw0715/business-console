import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { DEFAULT_KNOWLEDGE } from '@/lib/default-knowledge';
import type { Lang } from '@/lib/translations';

export async function GET() {
  const { rows } = await pool.query(`
    SELECT h.*,
      COUNT(ic.id) FILTER (WHERE ic.ended_at IS NULL) AS live_count
    FROM hotlines h
    LEFT JOIN inbound_calls ic ON ic.hotline_id = h.id
    GROUP BY h.id
    ORDER BY h.created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, twilio_number, system_prompt, voice_id, max_call_duration_sec, business_hours, after_hours_message, webhook_url, template, lang } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO hotlines (name, twilio_number) VALUES ($1, $2) RETURNING id`,
      [name, twilio_number],
    );
    const id = rows[0].id;

    await client.query(
      `INSERT INTO hotline_config (hotline_id, system_prompt, voice_id, max_call_duration_sec, business_hours, after_hours_message, webhook_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, system_prompt ?? '', voice_id ?? 'Cantonese_GentleLady', max_call_duration_sec ?? 300,
       JSON.stringify(business_hours ?? {}), after_hours_message ?? '', webhook_url ?? null],
    );

    const articles = template ? DEFAULT_KNOWLEDGE[template] : null;
    if (articles) {
      const resolvedLang: Lang = (['en', 'zh', 'pt'].includes(lang) ? lang : 'zh') as Lang;
      for (const article of articles) {
        await client.query(
          `INSERT INTO knowledge_base (hotline_id, title, content) VALUES ($1, $2, $3)`,
          [id, article.title[resolvedLang], article.content[resolvedLang]],
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}