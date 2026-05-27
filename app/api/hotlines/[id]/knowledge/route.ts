import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query(
    'SELECT id, title, content, created_at FROM knowledge_base WHERE hotline_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, content } = await req.json();

  const { rows: [article] } = await pool.query(
    `INSERT INTO knowledge_base (hotline_id, title, content) VALUES ($1, $2, $3) RETURNING id`,
    [id, title, content],
  );

  return NextResponse.json({ id: article.id }, { status: 201 });
}
