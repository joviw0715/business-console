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

// RFC-1918 + link-local + loopback prefixes to block SSRF
const PRIVATE_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
  '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.', '169.254.', '127.', '0.', '::1', 'localhost'];

/** Returns true if url is a safe external https:// destination (SSRF guard). */
export function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return !PRIVATE_PREFIXES.some(p => host === p.replace(/\.$/, '') || host.startsWith(p));
  } catch {
    return false;
  }
}
