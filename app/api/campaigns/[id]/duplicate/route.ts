import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch source campaign + config
    const { rows } = await client.query(`
      SELECT c.name, cc.system_prompt, cc.voice_id, cc.max_retries,
             cc.call_timeout_sec, cc.greeting_text, cc.webhook_url, cc.concurrency
      FROM campaigns c
      LEFT JOIN campaign_config cc ON cc.campaign_id = c.id
      WHERE c.id = $1
    `, [id]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const src = rows[0];

    const { rows: [newCampaign] } = await client.query(
      `INSERT INTO campaigns (name, status) VALUES ($1, 'draft') RETURNING id`,
      [`${src.name} (copy)`],
    );
    const newId = newCampaign.id;

    await client.query(
      `INSERT INTO campaign_config
         (campaign_id, system_prompt, voice_id, max_retries, call_timeout_sec, greeting_text, webhook_url, concurrency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newId, src.system_prompt ?? '', src.voice_id ?? 'Cantonese_GentleLady',
       src.max_retries ?? 2, src.call_timeout_sec ?? 60,
       src.greeting_text ?? '', src.webhook_url ?? null, src.concurrency ?? 3],
    );

    await client.query('COMMIT');
    return NextResponse.json({ id: newId }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}
