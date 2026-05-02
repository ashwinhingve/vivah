/**
 * Smart Shaadi — Entitlements & Premium Tier Types
 * packages/types/src/entitlements.ts
 *
 * Single source of truth for what each premium tier unlocks.
 * Mirrored in apps/api/src/lib/entitlements.ts (server) and
 * apps/web/src/hooks/useEntitlement.ts (client).
 */

export type PremiumTier = 'FREE' | 'STANDARD' | 'PREMIUM';

export interface Entitlements {
  /** Daily cap on outgoing match requests. Infinity = no cap. */
  dailyInterestLimit: number;
  /** See identities of users who viewed your profile. FREE sees blurred. */
  canViewViewers: boolean;
  /** See full identities on the /likes page. FREE sees blurred. */
  canViewWhoLikedMe: boolean;
  /** Purchase a 24h Profile Boost. */
  canBoost: boolean;
  /** Eligible to be picked as Profile of the Day by the daily cron. */
  profileOfDayEligible: boolean;
  /** Upload a 30s video introduction. STANDARD+ only. */
  canUploadVideoIntro: boolean;
  /** Tier-aware lastActiveAt precision: FREE = "Recently active". */
  showsPreciseLastActive: boolean;
}

/** Reason an action was blocked. Always paired with `requiredTier`. */
export interface UpgradeRequired {
  upgradeRequired: true;
  requiredTier: PremiumTier;
  feature: string;
}
