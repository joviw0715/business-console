import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin, getSession } from '@/lib/auth';

export async function POST(req: Request) {
  await requireAdmin();
  let accountId: number;
  try {
    ({ accountId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

  const { rows: [account] } = await pool.query(
    'SELECT id, username FROM accounts WHERE id = $1',
    [accountId],
  );
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const session = await getSession();
  session.impersonatingAccountId = account.id;
  session.impersonatingUsername = account.username;
  await session.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await requireAdmin();
  const session = await getSession();
  session.impersonatingAccountId = undefined;
  session.impersonatingUsername = undefined;
  await session.save();
  return NextResponse.json({ ok: true });
}
