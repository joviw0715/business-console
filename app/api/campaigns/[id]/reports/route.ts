import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT r.*, ct.name AS contact_name, ct.phone AS contact_phone
     FROM call_reports r JOIN contacts ct ON ct.id = r.contact_id
     WHERE r.campaign_id = $1 ORDER BY r.created_at DESC`,
    [id],
  );
  return NextResponse.json(rows);
}
