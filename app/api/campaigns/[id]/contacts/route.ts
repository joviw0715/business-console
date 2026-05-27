import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query(
    'SELECT * FROM contacts WHERE campaign_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const contacts: { name?: string; phone: string; custom_field?: string }[] = body.contacts ?? [];

  if (!contacts.length) return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of contacts) {
      if (!c.phone?.trim()) continue;
      await client.query(
        `INSERT INTO contacts (campaign_id, name, phone, custom_data, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [id, c.name ?? '', c.phone.trim(), c.custom_field ? JSON.stringify({ note: c.custom_field }) : null],
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, inserted: contacts.length });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
