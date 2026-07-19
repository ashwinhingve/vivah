/**
 * Smart Shaadi — Quota System Tests
 * apps/api/src/lib/__tests__/quotas.test.ts
 *
 * Tests the generalized quota system (interests, views, etc.)
 * Proves that interest quota behavior is unchanged after refactor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { asProfileId } from '@smartshaadi/types';
import {
  checkAndConsumeQuota,
  peekQuota,
  checkAndConsumeInterestQuota,
  peekInterestQuota,
  istDateKey,
  nextIstMidnightUnix,
} from '../quotas.js';
import { redis } from '../redis.js';

// Mock Redis
vi.mock('../redis.js', () => ({
  redis: {
    incr: vi.fn(),
    decr: vi.fn(),
    get: vi.fn(),
    expireat: vi.fn(),
  },
}));

describe('quotas', () => {
  const profileId = asProfileId('00000000-0000-0000-0000-000000000001');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('istDateKey', () => {
    it('returns YYYY-MM-DD in IST regardless of host TZ', () => {
      const key = istDateKey(new Date('2026-07-19T02:00:00Z')); // 7:30 AM IST
      expect(key).toBe('2026-07-19');
    });

    it('handles IST day boundary correctly', () => {
      const beforeMidnight = istDateKey(new Date('2026-07-18T18:29:59Z')); // 11:59:59 PM IST
      const atMidnight = istDateKey(new Date('2026-07-18T18:30:00Z')); // 12:00:00 AM IST next day
      expect(beforeMidnight).toBe('2026-07-18');
      expect(atMidnight).toBe('2026-07-19');
    });
  });

  describe('nextIstMidnightUnix', () => {
    it('returns Unix seconds at next IST midnight', () => {
      const nextMidnight = nextIstMidnightUnix(new Date('2026-07-19T02:00:00Z')); // 7:30 AM IST
      const date = new Date((nextMidnight + 1) * 1000); // +1 to go past midnight
      const dateInIst = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
      const timeInIst = dateInIst.toISOString().slice(11, 19);
      expect(timeInIst).toBe('00:00:01'); // just after midnight
    });
  });

  describe('checkAndConsumeQuota (generic)', () => {
    it('allows consumption up to the limit', async () => {
      const mocked = redis.incr as any;
      const mocked_expire = redis.expireat as any;

      // Call 1: used = 1, allowed
      mocked.mockResolvedValueOnce(1);
      let result = await checkAndConsumeQuota('interests', profileId, 5);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(1);
      expect(result.remaining).toBe(4);
      expect(mocked_expire).toHaveBeenCalledOnce();

      // Call 2: used = 2, allowed
      mocked.mockResolvedValueOnce(2);
      result = await checkAndConsumeQuota('interests', profileId, 5);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(2);
      expect(result.remaining).toBe(3);

      // Call 5: used = 5, allowed (exactly at limit)
      mocked.mockResolvedValueOnce(5);
      result = await checkAndConsumeQuota('interests', profileId, 5);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(5);
      expect(result.remaining).toBe(0);
    });

    it('refuses consumption beyond the limit and rolls back', async () => {
      const mocked_incr = redis.incr as any;
      const mocked_decr = redis.decr as any;

      // Call 6: INCR returns 6, which exceeds limit of 5
      mocked_incr.mockResolvedValueOnce(6);
      const result = await checkAndConsumeQuota('interests', profileId, 5);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(5); // reported as the limit, not 6
      expect(result.remaining).toBe(0);
      // Should have rolled back
      expect(mocked_decr).toHaveBeenCalledOnce();
    });

    it('skips Redis for infinite limits', async () => {
      const mocked = redis.incr as any;
      const result = await checkAndConsumeQuota('views', profileId, Number.POSITIVE_INFINITY);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
      expect(mocked).not.toHaveBeenCalled();
    });

    it('uses kind in Redis key for different quota types', async () => {
      const mocked_incr = redis.incr as any;

      mocked_incr.mockResolvedValueOnce(1);
      await checkAndConsumeQuota('interests', profileId, 5);
      const interestCall = (mocked_incr.mock.calls[0] as any)[0];
      expect(interestCall).toContain('quota:interests:');

      vi.clearAllMocks();

      mocked_incr.mockResolvedValueOnce(1);
      await checkAndConsumeQuota('views', profileId, 5);
      const viewCall = (mocked_incr.mock.calls[0] as any)[0];
      expect(viewCall).toContain('quota:views:');
    });
  });

  describe('peekQuota (read-only)', () => {
    it('reads quota usage without consuming', async () => {
      const mocked_get = redis.get as any;

      // No usage yet
      mocked_get.mockResolvedValueOnce(null);
      let result = await peekQuota('interests', profileId.toString(), 5);
      expect(result.used).toBe(0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);

      // 3 used
      mocked_get.mockResolvedValueOnce('3');
      result = await peekQuota('interests', profileId.toString(), 5);
      expect(result.used).toBe(3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);

      // Exactly at limit
      mocked_get.mockResolvedValueOnce('5');
      result = await peekQuota('interests', profileId.toString(), 5);
      expect(result.used).toBe(5);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('skips Redis for infinite limits', async () => {
      const mocked = redis.get as any;
      const result = await peekQuota('interests', profileId.toString(), Number.POSITIVE_INFINITY);
      expect(result.remaining).toBe(Number.POSITIVE_INFINITY);
      expect(mocked).not.toHaveBeenCalled();
    });
  });

  describe('checkAndConsumeInterestQuota (legacy wrapper)', () => {
    it('delegates to generic checkAndConsumeQuota with FREE tier limit', async () => {
      const mocked_incr = redis.incr as any;
      const mocked_expire = redis.expireat as any;

      mocked_incr.mockResolvedValueOnce(1);
      const result = await checkAndConsumeInterestQuota(profileId, 'FREE');

      // FREE tier has limit of 5
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(mocked_expire).toHaveBeenCalledOnce();
    });

    it('handles PREMIUM tier (infinite)', async () => {
      const mocked = redis.incr as any;
      const result = await checkAndConsumeInterestQuota(profileId, 'PREMIUM');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Number.POSITIVE_INFINITY);
      expect(mocked).not.toHaveBeenCalled();
    });

    it('handles STANDARD tier', async () => {
      const mocked_incr = redis.incr as any;

      mocked_incr.mockResolvedValueOnce(1);
      const result = await checkAndConsumeInterestQuota(profileId, 'STANDARD');

      // STANDARD tier has limit of 25
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(25);
    });
  });

  describe('peekInterestQuota (legacy wrapper)', () => {
    it('delegates to generic peekQuota with FREE tier limit', async () => {
      const mocked_get = redis.get as any;

      mocked_get.mockResolvedValueOnce('3');
      const result = await peekInterestQuota(profileId.toString(), 'FREE');

      // FREE tier has limit of 5
      expect(result.used).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(2);
    });

    it('handles PREMIUM tier (infinite)', async () => {
      const mocked = redis.get as any;
      const result = await peekInterestQuota(profileId.toString(), 'PREMIUM');

      expect(result.limit).toBe(Number.POSITIVE_INFINITY);
      expect(mocked).not.toHaveBeenCalled();
    });
  });

  describe('edge case: off-by-one', () => {
    it('5th consumption allowed, 6th refused (FREE tier)', async () => {
      const mocked_incr = redis.incr as any;
      const mocked_decr = redis.decr as any;

      // Consume 1-5 (all allowed)
      for (let i = 1; i <= 5; i++) {
        mocked_incr.mockResolvedValueOnce(i);
        const result = await checkAndConsumeInterestQuota(profileId, 'FREE');
        expect(result.allowed).toBe(true);
        expect(result.used).toBe(i);
      }

      // Consume 6 (refused, rolled back)
      mocked_incr.mockResolvedValueOnce(6);
      const result = await checkAndConsumeInterestQuota(profileId, 'FREE');
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(5); // reported as 5, not 6
      expect(mocked_decr).toHaveBeenCalledTimes(1);
    });
  });
});
