import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/types';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/twiml', '/api/webhooks'];
const ADMIN_PATHS = ['/admin', '/api/admin'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always pass through static assets regardless of matcher behaviour
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: 'bc-session',
  });

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && !session.isAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const proxyConfig = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
