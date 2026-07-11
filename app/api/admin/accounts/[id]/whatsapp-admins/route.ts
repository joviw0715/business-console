import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { rows } = await pool.query(
    'SELECT id, phone, name, created_at FROM whatsapp_admins WHERE account_id = $1 ORDER BY created_at ASC',
    [id],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  let phone: string, name: string;
  try { ({ phone, name } = await req.json()); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  if (!phone?.trim()) {
    return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
  }

  try {
    const { rows: [admin] } = await pool.query(
      `INSERT INTO whatsapp_admins (phone, name, account_id)
       VALUES ($1, $2, $3) RETURNING id, phone, name, created_at`,
      [phone.trim(), name?.trim() || null, id],
    );
    return NextResponse.json(admin, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique')) {
      return NextResponse.json({ error: 'Phone number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const url = new URL(req.url);
  const adminId = url.searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
  }

  const { rowCount } = await pool.query(
    'DELETE FROM whatsapp_admins WHERE id = $1 AND account_id = $2',
    [adminId, id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
