/**
 * Smart Shaadi — Profile View Quota Decision (Pure)
 * apps/api/src/profiles/quota.decision.ts
 *
 * Pure function to decide whether a profile view should be allowed.
 * Extracted so it can be tested independently of the router.
 * Returns either { allowed: true } or { allowed: false, error: ... }
 */

import type { PremiumTier } from '@smartshaadi/types';

export interface QuotaDecision {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
    upgradeRequired: boolean;
    requiredTier: PremiumTier;
    feature: string;
    quota: {
      used: number;
      limit: number;
      remaining: number;
    };
  };
}

export interface QuotaCheckInput {
  quotaEnabled: boolean;
  tier: PremiumTier;
  viewsUsed: number;
  viewsLimit: number;
}

/**
 * Pure decision logic for profile view quota enforcement.
 * Returns { allowed: true } if view is permitted, or error details if refused.
 */
export function decideProfileViewAllowed(input: QuotaCheckInput): QuotaDecision {
  // If quota enforcement is disabled globally, always allow
  if (!input.quotaEnabled) {
    return { allowed: true };
  }

  // If limit is infinity (STANDARD/PREMIUM), always allow
  if (!Number.isFinite(input.viewsLimit)) {
    return { allowed: true };
  }

  // If already at or past limit, refuse
  if (input.viewsUsed >= input.viewsLimit) {
    return {
      allowed: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: `Daily match view limit reached (${input.viewsLimit}/day on ${input.tier}). Upgrade for unlimited views.`,
        upgradeRequired: true,
        requiredTier: input.tier === 'FREE' ? 'STANDARD' : 'PREMIUM',
        feature: 'daily_view_quota',
        quota: {
          used: input.viewsLimit,
          limit: input.viewsLimit,
          remaining: 0,
        },
      },
    };
  }

  // Allow view
  return { allowed: true };
}
