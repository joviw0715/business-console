import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/types';

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'bc-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');
  if (!session.isAdmin) redirect('/');
  return session;
}

export function effectiveAccountId(session: SessionData): number {
  return session.impersonatingAccountId ?? session.accountId;
}
