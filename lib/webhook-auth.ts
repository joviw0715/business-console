import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of two strings via SHA-256 hashing.
 * Prevents timing-oracle attacks on shared-secret checks.
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
