import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ default: { query: vi.fn() } }));
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));
vi.mock('ioredis', () => {
  const mockInstance = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn(),
  };
  return {
    Redis: vi.fn(function () { return mockInstance; }),
    __mockInstance: mockInstance,
  };
});

import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { POST } from '@/app/api/auth/login/route';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;
const mockGetSession = getSession as ReturnType<typeof vi.fn>;
const mockCompare = bcrypt.compare as ReturnType<typeof vi.fn>;

function makeSession() {
  return {
    isLoggedIn: false,
    accountId: 0,
    username: '',
    isAdmin: false,
    save: vi.fn(),
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('returns 401 when username is missing', async () => {
    const res = await POST(makeRequest({ password: 'pw' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is missing', async () => {
    const res = await POST(makeRequest({ username: 'user' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when no DB row matches username', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await POST(makeRequest({ username: 'unknown', password: 'pw' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when bcrypt.compare returns false', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 1, username: 'user', password_hash: 'hash', is_admin: false }],
    });
    mockCompare.mockResolvedValue(false);
    const res = await POST(makeRequest({ username: 'user', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('returns { ok: true, isAdmin: false } and saves session on valid non-admin login', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 42, username: 'user', password_hash: 'hash', is_admin: false }],
    });
    mockCompare.mockResolvedValue(true);
    const session = makeSession();
    mockGetSession.mockResolvedValue(session);

    const res = await POST(makeRequest({ username: 'user', password: 'correct' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.isAdmin).toBe(false);
    expect(session.isLoggedIn).toBe(true);
    expect(session.accountId).toBe(42);
    expect(session.save).toHaveBeenCalledOnce();
  });

  it('returns { ok: true, isAdmin: true } on valid admin login', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 1, username: 'admin', password_hash: 'hash', is_admin: true }],
    });
    mockCompare.mockResolvedValue(true);
    mockGetSession.mockResolvedValue(makeSession());

    const res = await POST(makeRequest({ username: 'admin', password: 'correct' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isAdmin).toBe(true);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { Redis } = await import('ioredis');
    // Make the next Redis instance return count > 5
    (Redis as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
      return {
        incr: vi.fn().mockResolvedValue(6),
        expire: vi.fn().mockResolvedValue(1),
        disconnect: vi.fn(),
      };
    });
    const res = await POST(makeRequest({ username: 'user', password: 'pw' }));
    expect(res.status).toBe(429);
  });
});
