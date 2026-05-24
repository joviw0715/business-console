import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query(
    'SELECT * FROM contacts WHERE campaign_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return NextResponse.json(rows);
}
