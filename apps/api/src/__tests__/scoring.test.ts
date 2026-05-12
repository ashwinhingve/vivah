/**
 * Behaviour-based matching scorer tests.
 *
 * Covers scoreBehaviourCompat() in apps/api/src/matchmaking/scorer.ts —
 * activity-compat, timing-compat (hourly hist overlap), engagement-compat,
 * and the cold-start fallback.
 */
import { describe, it, expect, vi } from 'vitest';
import { scoreBehaviourCompat } from '../matchmaking/scorer.js';
import type { BehaviourRollup } from '../matchmaking/behaviourFeatures.js';

// scorer.ts imports drizzle-orm transitively via behaviourFeatures. Vitest
// resolves the production package fine but db.ts pulls in ioredis etc. — we
// stub the db module so unit tests don't need it. Hoisted before imports.
vi.mock('../lib/db.js', () => ({ db: {} }));

const HOURS = (...vals: Array<[hour: number, count: number]>): number[] => {
  const arr = new Array<number>(24).fill(0);
  for (const [h, c] of vals) arr[h] = c;
  return arr;
};

function rollup(
  partial: Partial<BehaviourRollup> & { userId: string; daysWithData: number },
): BehaviourRollup {
  return {
    userId:           partial.userId,
    activityLevel:    partial.activityLevel ?? 0.5,
    messageFrequency: partial.messageFrequency ?? 1,
    hourlyHist:       partial.hourlyHist ?? new Array<number>(24).fill(1),
    daysWithData:     partial.daysWithData,
  };
}

describe('scoreBehaviourCompat', () => {
  it('returns 50 cold-start when either side has <7 days of data', () => {
    const u = rollup({ userId: 'u', daysWithData: 5 });
    const c = rollup({ userId: 'c', daysWithData: 30 });
    const result = scoreBehaviourCompat(u, c);
    expect(result.score).toBe(50);
    expect(result.coldStart).toBe(true);
  });

  it('scores high when activity, timing, and engagement all align', () => {
    const u = rollup({
      userId: 'u',
      daysWithData: 30,
      activityLevel: 0.6,
      messageFrequency: 3,
      hourlyHist: HOURS([8, 10], [9, 10], [20, 10], [21, 10]),
    });
    const c = rollup({
      userId: 'c',
      daysWithData: 30,
      activityLevel: 0.6,
      messageFrequency: 3,
      hourlyHist: HOURS([8, 10], [9, 10], [20, 10], [21, 10]),
    });
    const result = scoreBehaviourCompat(u, c);
    expect(result.coldStart).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it('scores low timing-compat when hourly hists do not overlap', () => {
    const u = rollup({
      userId: 'u',
      daysWithData: 30,
      activityLevel: 0.5,
      messageFrequency: 1,
      hourlyHist: HOURS([6, 10], [7, 10], [8, 10]),       // morning user
    });
    const c = rollup({
      userId: 'c',
      daysWithData: 30,
      activityLevel: 0.5,
      messageFrequency: 1,
      hourlyHist: HOURS([22, 10], [23, 10], [0, 10]),     // night-owl user
    });
    const result = scoreBehaviourCompat(u, c);
    expect(result.coldStart).toBe(false);
    // activity_compat = 1, engagement_compat = 1, timing_compat = 0
    // score = (0.4*1 + 0.4*0 + 0.2*1) * 100 = 60
    expect(result.score).toBe(60);
  });

  it('scores poorly when message frequency mismatches and activity diverges', () => {
    const u = rollup({
      userId: 'u',
      daysWithData: 30,
      activityLevel: 0.95,
      messageFrequency: 10,
      hourlyHist: HOURS([12, 10]),
    });
    const c = rollup({
      userId: 'c',
      daysWithData: 30,
      activityLevel: 0.05,
      messageFrequency: 0,
      hourlyHist: HOURS([0, 10]),  // different hour entirely
    });
    const result = scoreBehaviourCompat(u, c);
    expect(result.coldStart).toBe(false);
    // activity_compat ≈ 0.1, timing_compat = 0, engagement_compat = 0
    // score = (0.04 + 0 + 0) * 100 ≈ 4
    expect(result.score).toBeLessThanOrEqual(10);
  });
});
