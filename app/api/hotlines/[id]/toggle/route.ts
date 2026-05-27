import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { rows: [hotline] } = await pool.query('SELECT status FROM hotlines WHERE id = $1', [id]);
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus = hotline.status === 'active' ? 'paused' : 'active';
  await pool.query('UPDATE hotlines SET status = $1 WHERE id = $2', [newStatus, id]);

  return NextResponse.json({ ok: true, status: newStatus });
}
