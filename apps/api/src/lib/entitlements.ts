/**
 * Smart Shaadi — Entitlements (server)
 * apps/api/src/lib/entitlements.ts
 *
 * Single source of truth for premium feature gating.
 */

import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from './db.js';
import type { Entitlements, PremiumTier } from '@smartshaadi/types';

const TABLE: Record<PremiumTier, Entitlements> = {
  FREE: {
    dailyInterestLimit: 5,
    canViewViewers: false,
    canViewWhoLikedMe: false,
    canBoost: false,
    profileOfDayEligible: false,
    canUploadVideoIntro: false,
    showsPreciseLastActive: false,
  },
  STANDARD: {
    dailyInterestLimit: 25,
    canViewViewers: true,
    canViewWhoLikedMe: false,
    canBoost: false,
    profileOfDayEligible: false,
    canUploadVideoIntro: true,
    showsPreciseLastActive: true,
  },
  PREMIUM: {
    dailyInterestLimit: Number.POSITIVE_INFINITY,
    canViewViewers: true,
    canViewWhoLikedMe: true,
    canBoost: true,
    profileOfDayEligible: true,
    canUploadVideoIntro: true,
    showsPreciseLastActive: true,
  },
};

export function getEntitlements(tier: PremiumTier): Entitlements {
  return TABLE[tier];
}

export function tierAtLeast(actual: PremiumTier, required: PremiumTier): boolean {
  const order: PremiumTier[] = ['FREE', 'STANDARD', 'PREMIUM'];
  return order.indexOf(actual) >= order.indexOf(required);
}

const tierCache = new Map<string, { tier: PremiumTier; profileId: string; expiresAt: number }>();
const TIER_TTL_MS = 60_000;

/** Resolve userId → { profileId, tier }. Cached 60s to avoid hot-path lookups. */
export async function getProfileTier(userId: string): Promise<{ profileId: string; tier: PremiumTier } | null> {
  const hit = tierCache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return { profileId: hit.profileId, tier: hit.tier };
  const [row] = await db
    .select({ id: profiles.id, tier: profiles.premiumTier })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!row) return null;
  tierCache.set(userId, { profileId: row.id, tier: row.tier, expiresAt: Date.now() + TIER_TTL_MS });
  return { profileId: row.id, tier: row.tier };
}

export function invalidateTierCache(userId: string): void {
  tierCache.delete(userId);
}
