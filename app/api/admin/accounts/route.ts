import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const { rows } = await pool.query(
    `SELECT id, username, display_name, is_admin, created_at FROM accounts ORDER BY created_at ASC`,
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireAdmin();
  const { username, password, displayName } = await req.json();

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { rows: [account] } = await pool.query(
      `INSERT INTO accounts (username, password_hash, display_name)
       VALUES ($1, $2, $3) RETURNING id, username, display_name, created_at`,
      [username.trim(), passwordHash, displayName?.trim() || null],
    );
    return NextResponse.json(account, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
