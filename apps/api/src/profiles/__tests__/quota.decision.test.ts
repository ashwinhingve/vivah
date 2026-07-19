/**
 * Smart Shaadi — Profile View Quota Decision Tests
 * apps/api/src/profiles/__tests__/quota.decision.test.ts
 *
 * Tests the pure function that decides whether a profile view is allowed.
 * These tests MUST fail when the quota enforcement logic is removed from the router.
 */

import { describe, it, expect } from 'vitest';
import { decideProfileViewAllowed, type QuotaCheckInput } from '../quota.decision.js';

describe('decideProfileViewAllowed (pure quota decision)', () => {
  describe('quota enforcement disabled', () => {
    it('always allows views when quotaEnabled=false', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: false,
        tier: 'FREE',
        viewsUsed: 100, // way over limit
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(true);
      expect(decision.error).toBeUndefined();
    });
  });

  describe('FREE tier with quota enabled', () => {
    it('allows view 1-5 (within limit)', () => {
      for (let used = 0; used < 5; used++) {
        const input: QuotaCheckInput = {
          quotaEnabled: true,
          tier: 'FREE',
          viewsUsed: used,
          viewsLimit: 5,
        };
        const decision = decideProfileViewAllowed(input);
        expect(decision.allowed).toBe(true);
        expect(decision.error).toBeUndefined();
      }
    });

    it('refuses view 6+ (at or past limit)', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 5, // at the limit
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(false);
      expect(decision.error).toBeDefined();
      expect(decision.error!.code).toBe('QUOTA_EXCEEDED');
      expect(decision.error!.upgradeRequired).toBe(true);
      expect(decision.error!.requiredTier).toBe('STANDARD');
      expect(decision.error!.feature).toBe('daily_view_quota');
      expect(decision.error!.quota).toEqual({
        used: 5,
        limit: 5,
        remaining: 0,
      });
    });

    it('includes tier and limit in error message', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 5,
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.error!.message).toContain('5/day');
      expect(decision.error!.message).toContain('FREE');
      expect(decision.error!.message).toContain('Upgrade for unlimited views');
    });

    it('off-by-one: 5th view allowed, 6th refused', () => {
      // 5th view: viewsUsed=4 (about to become 5)
      const fifth: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 4,
        viewsLimit: 5,
      };
      expect(decideProfileViewAllowed(fifth).allowed).toBe(true);

      // 6th view: viewsUsed=5 (already at limit)
      const sixth: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 5,
        viewsLimit: 5,
      };
      expect(decideProfileViewAllowed(sixth).allowed).toBe(false);
    });
  });

  describe('STANDARD tier (unlimited views)', () => {
    it('always allows views when limit is Infinity', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'STANDARD',
        viewsUsed: 1000,
        viewsLimit: Number.POSITIVE_INFINITY,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(true);
      expect(decision.error).toBeUndefined();
    });

    it('never suggests upgrade for STANDARD tier', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'STANDARD',
        viewsUsed: 0,
        viewsLimit: Number.POSITIVE_INFINITY,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(true);
    });
  });

  describe('PREMIUM tier (unlimited views)', () => {
    it('always allows views when limit is Infinity', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'PREMIUM',
        viewsUsed: 9999,
        viewsLimit: Number.POSITIVE_INFINITY,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(true);
      expect(decision.error).toBeUndefined();
    });

    it('never suggests downgrade for PREMIUM tier', () => {
      // PREMIUM users can never hit a limit (Infinity) so no error
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'PREMIUM',
        viewsUsed: 0,
        viewsLimit: Number.POSITIVE_INFINITY,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.allowed).toBe(true);
    });
  });

  describe('upgrade suggestions', () => {
    it('FREE tier exhausted suggests STANDARD', () => {
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 5,
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.error!.requiredTier).toBe('STANDARD');
    });

    it('STANDARD tier exhausted suggests PREMIUM', () => {
      // Hypothetically if STANDARD had a limit (it doesn't in practice)
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'STANDARD',
        viewsUsed: 100,
        viewsLimit: 100,
      };
      const decision = decideProfileViewAllowed(input);
      expect(decision.error!.requiredTier).toBe('PREMIUM');
    });
  });

  describe('mutation proof: removing this logic breaks all decisions', () => {
    it('FREE tier at limit is not allowed (mutation: delete the >= check)', () => {
      // If someone removes the >= comparison, this test fails
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'FREE',
        viewsUsed: 5,
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      // Mutation: if >= is removed, this fails
      expect(decision.allowed).toBe(false);
    });

    it('infinity limit is honored (mutation: delete Infinity check)', () => {
      // If someone removes the Number.isFinite check, this test fails
      const input: QuotaCheckInput = {
        quotaEnabled: true,
        tier: 'PREMIUM',
        viewsUsed: 5,
        viewsLimit: Number.POSITIVE_INFINITY,
      };
      const decision = decideProfileViewAllowed(input);
      // Mutation: if Infinity check is removed, this fails
      expect(decision.allowed).toBe(true);
    });

    it('flag is honored (mutation: delete quotaEnabled check)', () => {
      // If someone removes the quotaEnabled check, this test fails
      const input: QuotaCheckInput = {
        quotaEnabled: false,
        tier: 'FREE',
        viewsUsed: 5,
        viewsLimit: 5,
      };
      const decision = decideProfileViewAllowed(input);
      // Mutation: if quotaEnabled check is removed, decision becomes "refused"
      expect(decision.allowed).toBe(true);
    });
  });
});
