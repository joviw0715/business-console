import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id, kid } = await params;
  let title: unknown, content: unknown;
  try { ({ title, content } = await req.json()); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rowCount } = await pool.query(
    `UPDATE knowledge_base SET title = $1, content = $2, updated_at = NOW()
     WHERE id = $3 AND hotline_id = $4`,
    [title, content, kid, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; kid: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id, kid } = await params;

  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rowCount } = await pool.query(
    'DELETE FROM knowledge_base WHERE id = $1 AND hotline_id = $2',
    [kid, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
