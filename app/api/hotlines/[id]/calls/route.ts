import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const { rows } = await pool.query(
    `SELECT * FROM inbound_calls
     WHERE hotline_id = $1
     ORDER BY started_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset],
  );

  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM inbound_calls WHERE hotline_id = $1',
    [id],
  );

  return NextResponse.json({ calls: rows, total: parseInt(count) });
}
