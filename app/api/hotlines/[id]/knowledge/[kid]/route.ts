import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const { id, kid } = await params;
  const { title, content } = await req.json();

  const { rowCount } = await pool.query(
    `UPDATE knowledge_base SET title = $1, content = $2, updated_at = NOW()
     WHERE id = $3 AND hotline_id = $4`,
    [title, content, kid, id],
  );

  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const { id, kid } = await params;

  const { rowCount } = await pool.query(
    'DELETE FROM knowledge_base WHERE id = $1 AND hotline_id = $2',
    [kid, id],
  );

  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
