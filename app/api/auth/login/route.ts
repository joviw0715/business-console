import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import pool from '@/lib/db';
import { Redis } from 'ioredis';

const RATE_LIMIT_WINDOW_SEC = 15 * 60; // 15 minutes
const RATE_LIMIT_MAX = 5;

// Module-level singleton — one connection reused across requests.
let _rateLimitClient: Redis | null = null;

function getRateLimitClient(): Redis {
  if (!_rateLimitClient) {
    _rateLimitClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    _rateLimitClient.on('error', () => { /* suppress unhandled-rejection noise */ });
  }
  return _rateLimitClient;
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRateLimitClient();
  try {
    const key = `ratelimit:login:${ip}`;
    // Atomic pipeline: INCR + EXPIRE in one round-trip, no TTL-missing race
    const results = await client.pipeline().incr(key).expire(key, RATE_LIMIT_WINDOW_SEC).exec();
    const n = (results?.[0]?.[1] as number) ?? 0;
    return { allowed: n <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - n) };
  } catch {
    // Redis unavailable — fail open to avoid locking out all users
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }
}

export async function POST(req: Request) {
  // Rate limiting by IP
  const ip = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
  const { allowed, remaining } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429, headers: { 'Retry-After': String(RATE_LIMIT_WINDOW_SEC) } },
    );
  }

  let username: string, password: string;
  try {
    ({ username, password } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await pool.query(
    'SELECT id, username, password_hash, is_admin FROM accounts WHERE username = $1',
    [username],
  );

  if (rows.length === 0) {
    // ponytail: dummy compare to prevent username enumeration via timing
    await bcrypt.compare(password, '$2b$10$invalidhashpadding000000000000000000000000000000000000000');
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
