import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Returns 401 if WEBHOOK_SECRET is set and the Bearer token doesn't match. No-ops when unset. */
export function checkWebhookSecret(req: Request): NextResponse | null {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return null; // ponytail: backward compat — add WEBHOOK_SECRET env var to enforce auth
  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeCompare(provided, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
