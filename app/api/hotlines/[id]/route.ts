import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { rows } = await pool.query(`
    SELECT h.*, hc.system_prompt, hc.voice_id, hc.max_call_duration_sec,
           hc.business_hours, hc.after_hours_message, hc.webhook_url, hc.memory_enabled
    FROM hotlines h
    LEFT JOIN hotline_config hc ON hc.hotline_id = h.id
    WHERE h.id = $1
  `, [id]);

  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, twilio_number, system_prompt, voice_id, max_call_duration_sec, business_hours, after_hours_message, webhook_url, memory_enabled, wa_confirmation_enabled } = body;

  if (name || twilio_number) {
    await pool.query(
      `UPDATE hotlines SET
        name = COALESCE($2, name),
        twilio_number = COALESCE($3, twilio_number)
       WHERE id = $1`,
      [id, name ?? null, twilio_number ?? null],
    );
  }

  await pool.query(
    `INSERT INTO hotline_config (hotline_id, system_prompt, voice_id, max_call_duration_sec, business_hours, after_hours_message, webhook_url, memory_enabled, wa_confirmation_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (hotline_id) DO UPDATE SET
       system_prompt = EXCLUDED.system_prompt,
       voice_id = EXCLUDED.voice_id,
       max_call_duration_sec = EXCLUDED.max_call_duration_sec,
       business_hours = EXCLUDED.business_hours,
       after_hours_message = EXCLUDED.after_hours_message,
       webhook_url = EXCLUDED.webhook_url,
       memory_enabled = EXCLUDED.memory_enabled,
       wa_confirmation_enabled = EXCLUDED.wa_confirmation_enabled`,
    [id, system_prompt ?? '', voice_id ?? 'Cantonese_GentleLady', max_call_duration_sec ?? 300,
     JSON.stringify(business_hours ?? {}), after_hours_message ?? '', webhook_url ?? null, memory_enabled ?? true,
     wa_confirmation_enabled ?? false],
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rowCount } = await pool.query('DELETE FROM hotlines WHERE id = $1', [id]);
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
