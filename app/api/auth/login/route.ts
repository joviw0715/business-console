import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await pool.query(
    'SELECT id, username, password_hash, is_admin FROM accounts WHERE username = $1',
    [username],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const account = rows[0];
  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.accountId = account.id;
  session.username = account.username;
  session.isAdmin = account.is_admin;
  await session.save();

  return NextResponse.json({ ok: true, isAdmin: account.is_admin });
}
