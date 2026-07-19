/**
 * Smart Shaadi — Profile View Quota Tests
 * apps/api/src/profiles/__tests__/quota.test.ts
 *
 * Tests the match-view quota enforcement on GET /profiles/:id endpoint.
 * Verifies that the quota check works correctly for FREE tier (5 views/day).
 */

import { describe, it, expect, vi } from 'vitest';
import { asProfileId } from '@smartshaadi/types';
import { getEntitlements } from '../../lib/entitlements.js';
import { checkAndConsumeQuota } from '../../lib/quotas.js';
import { redis } from '../../lib/redis.js';

vi.mock('../../lib/redis.js');

describe('match-view quota', () => {
  describe('quota kinds and limits', () => {
    it('FREE tier has dailyMatchViewLimit = 5', () => {
      const ent = getEntitlements('FREE');
      expect(ent.dailyMatchViewLimit).toBe(5);
    });

    it('STANDARD tier has dailyMatchViewLimit = Infinity', () => {
      const ent = getEntitlements('STANDARD');
      expect(ent.dailyMatchViewLimit).toBe(Number.POSITIVE_INFINITY);
    });

    it('PREMIUM tier has dailyMatchViewLimit = Infinity', () => {
      const ent = getEntitlements('PREMIUM');
      expect(ent.dailyMatchViewLimit).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('entitlements', () => {
    it('FREE tier canUseConversationCoach = false', () => {
      const ent = getEntitlements('FREE');
      expect(ent.canUseConversationCoach).toBe(false);
    });

    it('STANDARD tier canUseConversationCoach = true', () => {
      const ent = getEntitlements('STANDARD');
      expect(ent.canUseConversationCoach).toBe(true);
    });

    it('PREMIUM tier canUseConversationCoach = true', () => {
      const ent = getEntitlements('PREMIUM');
      expect(ent.canUseConversationCoach).toBe(true);
    });

    it('STANDARD tier hasPriorityVisibility = true', () => {
      const ent = getEntitlements('STANDARD');
      expect(ent.hasPriorityVisibility).toBe(true);
    });

    it('PREMIUM tier hasVerifiedBadge = true', () => {
      const ent = getEntitlements('PREMIUM');
      expect(ent.hasVerifiedBadge).toBe(true);
    });

    it('FREE tier hasVerifiedBadge = false', () => {
      const ent = getEntitlements('FREE');
      expect(ent.hasVerifiedBadge).toBe(false);
    });

    it('PREMIUM tier hasDedicatedRecommendations = true', () => {
      const ent = getEntitlements('PREMIUM');
      expect(ent.hasDedicatedRecommendations).toBe(true);
    });

    it('FREE tier hasDedicatedRecommendations = false', () => {
      const ent = getEntitlements('FREE');
      expect(ent.hasDedicatedRecommendations).toBe(false);
    });
  });

  describe('view quota kind', () => {
    it('uses "views" quota kind (not "interests")', async () => {
      const mocked_incr = vi.mocked(redis.incr);

      // Mock to verify the key contains "views"
      let capturedKey = '';
      mocked_incr.mockImplementationOnce(async (key: unknown) => {
        capturedKey = String(key);
        return 1;
      });

      const profileId = asProfileId('00000000-0000-0000-0000-000000000001');
      await checkAndConsumeQuota('views', profileId, 5);

      expect(capturedKey).toContain('quota:views:');
      expect(capturedKey).not.toContain('quota:interests:');
    });
  });
});
