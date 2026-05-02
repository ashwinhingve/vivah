/**
 * Smart Shaadi — Daily quota counter (Redis)
 * apps/api/src/lib/quotas.ts
 *
 * IST-anchored daily INCR with EXPIREAT at next IST midnight.
 * Used to enforce premium-tier interest limits server-side.
 */

import { redis } from './redis.js';
import { getEntitlements } from './entitlements.js';
import type { PremiumTier } from '@smartshaadi/types';

/** Returns YYYY-MM-DD in IST regardless of host clock TZ. */
export function istDateKey(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Returns Unix seconds at the next IST midnight after `now`. */
export function nextIstMidnightUnix(now: Date = new Date()): number {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCHours(24, 0, 0, 0);
  return Math.floor((ist.getTime() - 5.5 * 60 * 60 * 1000) / 1000);
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Atomically check + consume one unit of the interest quota.
 * PREMIUM tier (Infinity limit) skips Redis entirely.
 */
export async function checkAndConsumeInterestQuota(
  profileId: string,
  tier: PremiumTier,
): Promise<QuotaResult> {
  const limit = getEntitlements(tier).dailyInterestLimit;
  if (!Number.isFinite(limit)) {
    return { allowed: true, used: 0, limit, remaining: limit };
  }
  const key = `quota:interests:${profileId}:${istDateKey()}`;
  const used = await redis.incr(key);
  if (used === 1) {
    await redis.expireat(key, nextIstMidnightUnix());
  }
  if (used > limit) {
    // rollback the over-consumption so subsequent calls still report accurate count
    await redis.decr(key);
    return { allowed: false, used: limit, limit, remaining: 0 };
  }
  return { allowed: true, used, limit, remaining: limit - used };
}

export async function peekInterestQuota(profileId: string, tier: PremiumTier): Promise<QuotaResult> {
  const limit = getEntitlements(tier).dailyInterestLimit;
  if (!Number.isFinite(limit)) return { allowed: true, used: 0, limit, remaining: limit };
  const key = `quota:interests:${profileId}:${istDateKey()}`;
  const raw = await redis.get(key);
  const used = raw ? parseInt(raw, 10) : 0;
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}
