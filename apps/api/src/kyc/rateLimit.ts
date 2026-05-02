// ─────────────────────────────────────────────────────────────────────────────
// KYC attempt rate limiter — Redis sliding-window per profile.
// Default: 5 attempts / 24h. After exceeding, profile gets locked for 24h.
// In mock-mode (no Redis available) the limiter is a no-op so dev/tests pass.
// ─────────────────────────────────────────────────────────────────────────────
import { redis } from '../lib/redis.js';
import { env } from '../lib/env.js';

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_SECONDS = 24 * 60 * 60;
const LOCK_DURATION_SECONDS = 24 * 60 * 60;

export interface RateLimitResult {
  allowed:    boolean;
  count:      number;
  remaining:  number;
  retryAfter: number; // seconds until next allowed attempt
  locked:     boolean;
}

export async function checkKycRateLimit(profileId: string, op: string): Promise<RateLimitResult> {
  if (env.USE_MOCK_SERVICES) {
    return { allowed: true, count: 0, remaining: DEFAULT_LIMIT, retryAfter: 0, locked: false };
  }

  const counterKey = `kyc:rate:${op}:${profileId}`;
  const lockKey    = `kyc:lock:${profileId}`;

  try {
    const lockTtl = await redis.ttl(lockKey);
    if (lockTtl > 0) {
      return { allowed: false, count: DEFAULT_LIMIT + 1, remaining: 0, retryAfter: lockTtl, locked: true };
    }

    const count = await redis.incr(counterKey);
    if (count === 1) await redis.expire(counterKey, DEFAULT_WINDOW_SECONDS);

    if (count > DEFAULT_LIMIT) {
      await redis.set(lockKey, '1', 'EX', LOCK_DURATION_SECONDS);
      return { allowed: false, count, remaining: 0, retryAfter: LOCK_DURATION_SECONDS, locked: true };
    }

    return {
      allowed:    true,
      count,
      remaining:  DEFAULT_LIMIT - count,
      retryAfter: 0,
      locked:     false,
    };
  } catch (e) {
    console.error('[kyc/rateLimit] failed', e);
    // Fail open — never block legitimate users on infra errors
    return { allowed: true, count: 0, remaining: DEFAULT_LIMIT, retryAfter: 0, locked: false };
  }
}

export async function clearKycRateLimit(profileId: string): Promise<void> {
  if (env.USE_MOCK_SERVICES) return;
  try {
    const keys = await redis.keys(`kyc:rate:*:${profileId}`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.del(`kyc:lock:${profileId}`);
  } catch (e) {
    console.error('[kyc/rateLimit] clear failed', e);
  }
}
