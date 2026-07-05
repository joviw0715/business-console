import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { timingSafeEqual } from 'crypto';
import type { SessionData } from '@/types';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/twiml', '/api/webhooks'];
const ADMIN_PATHS = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow internal service-to-service calls with valid Bearer token
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const internalToken = process.env.CONSOLE_API_TOKEN || process.env.SESSION_SECRET;
  if (bearerToken && internalToken) {
    try {
      const a = Buffer.from(bearerToken);
      const b = Buffer.from(internalToken);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return NextResponse.next();
      }
    } catch {
      // fall through to session check
    }
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
