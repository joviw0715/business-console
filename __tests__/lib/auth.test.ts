import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before imports
vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

import { getIronSession } from 'iron-session';
import { getSession, requireAuth, requireAdmin, effectiveAccountId } from '@/lib/auth';

const mockGetIronSession = getIronSession as ReturnType<typeof vi.fn>;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    isLoggedIn: false,
    isAdmin: false,
    accountId: 1,
    username: 'test',
    impersonatingAccountId: undefined,
    save: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSession', () => {
  it('returns the iron-session object', async () => {
    const session = makeSession({ isLoggedIn: true });
    mockGetIronSession.mockResolvedValue(session);
    const result = await getSession();
    expect(result).toBe(session);
  });
});

describe('requireAuth', () => {
  it('throws redirect to /login when not logged in', async () => {
    const session = makeSession({ isLoggedIn: false });
    mockGetIronSession.mockResolvedValue(session);
    await expect(requireAuth()).rejects.toThrow('REDIRECT:/login');
  });

  it('returns session when logged in', async () => {
    const session = makeSession({ isLoggedIn: true });
    mockGetIronSession.mockResolvedValue(session);
    const result = await requireAuth();
    expect(result).toBe(session);
  });
});

describe('requireAdmin', () => {
  it('throws redirect to /login when not logged in', async () => {
    mockGetIronSession.mockResolvedValue(makeSession({ isLoggedIn: false }));
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/login');
  });

  it('throws redirect to / when logged in but not admin', async () => {
    mockGetIronSession.mockResolvedValue(makeSession({ isLoggedIn: true, isAdmin: false }));
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/');
  });

  it('returns session when logged in and admin', async () => {
    const session = makeSession({ isLoggedIn: true, isAdmin: true });
    mockGetIronSession.mockResolvedValue(session);
    const result = await requireAdmin();
    expect(result).toBe(session);
  });
});

describe('effectiveAccountId', () => {
  it('returns impersonatingAccountId when set', () => {
    const session = makeSession({ accountId: 1, impersonatingAccountId: 99 }) as any;
    expect(effectiveAccountId(session)).toBe(99);
  });

  it('returns accountId when impersonatingAccountId is absent', () => {
    const session = makeSession({ accountId: 5, impersonatingAccountId: undefined }) as any;
    expect(effectiveAccountId(session)).toBe(5);
  });

  it('returns accountId when impersonatingAccountId is null', () => {
    const session = makeSession({ accountId: 7, impersonatingAccountId: null }) as any;
    expect(effectiveAccountId(session)).toBe(7);
  });
});
