import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, emoji, industry, voice_id, script, greeting } = await req.json();

  const { rowCount } = await pool.query(
    `UPDATE campaign_templates SET
       name     = COALESCE($1, name),
       emoji    = COALESCE($2, emoji),
       industry = COALESCE($3, industry),
       voice_id = COALESCE($4, voice_id),
       script   = COALESCE($5, script),
       greeting = COALESCE($6, greeting),
       updated_at = NOW()
     WHERE id = $7`,
    [name ?? null, emoji ?? null, industry ?? null, voice_id ?? null,
     script ?? null, greeting ?? null, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rowCount } = await pool.query(
    'DELETE FROM campaign_templates WHERE id = $1',
    [id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
