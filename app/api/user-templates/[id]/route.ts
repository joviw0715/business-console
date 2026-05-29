import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query('SELECT * FROM user_templates WHERE id = $1', [id]);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, emoji, campaign_name, greeting_text, system_prompt,
          hotline_name, hotline_system_prompt, after_hours_message } = body;

  const { rowCount } = await pool.query(
    `UPDATE user_templates SET
       name = COALESCE($1, name),
       emoji = COALESCE($2, emoji),
       campaign_name = $3,
       greeting_text = $4,
       system_prompt = $5,
       hotline_name = $6,
       hotline_system_prompt = $7,
       after_hours_message = $8,
       updated_at = NOW()
     WHERE id = $9`,
    [name ?? null, emoji ?? null, campaign_name ?? null, greeting_text ?? null,
     system_prompt ?? null, hotline_name ?? null, hotline_system_prompt ?? null,
     after_hours_message ?? null, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rowCount } = await pool.query('DELETE FROM user_templates WHERE id = $1', [id]);
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
