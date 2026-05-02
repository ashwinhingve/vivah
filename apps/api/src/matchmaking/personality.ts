/**
 * Smart Shaadi — Personality dimension scorer.
 * 6-axis Euclidean similarity, normalized to a 0..15 scoring band.
 */

import type { PersonalityProfile, PersonalityIdeal } from '@smartshaadi/types';

export const AXIS_KEYS = [
  'introvertExtrovert',
  'traditionalModern',
  'plannerSpontaneous',
  'religiousSecular',
  'ambitiousBalanced',
  'familyIndependent',
] as const;

export type AxisKey = typeof AXIS_KEYS[number];

const MAX_AXIS_DELTA = 6; // 7 - 1
const MAX_TOTAL_DISTANCE = Math.sqrt(AXIS_KEYS.length * MAX_AXIS_DELTA * MAX_AXIS_DELTA);
const WEIGHT = 15;

export interface PersonalityScoreResult {
  score: number;
  flag: 'personality_pending' | null;
}

export function scorePersonality(
  user: PersonalityProfile | null | undefined,
  candidate: PersonalityProfile | null | undefined,
  userIdeal?: PersonalityIdeal,
): PersonalityScoreResult {
  if (!user || !candidate) {
    return { score: 7, flag: 'personality_pending' };
  }
  let sumSquares = 0;
  for (const axis of AXIS_KEYS) {
    const u = user[axis];
    const c = candidate[axis];
    if (typeof u !== 'number' || typeof c !== 'number') {
      return { score: 7, flag: 'personality_pending' };
    }
    const tolerance = userIdeal?.[axis]?.tolerance ?? MAX_AXIS_DELTA;
    const delta = Math.min(Math.abs(u - c), tolerance);
    sumSquares += delta * delta;
  }
  const dist = Math.sqrt(sumSquares);
  const normalized = dist / MAX_TOTAL_DISTANCE;
  const score = Math.max(0, Math.min(WEIGHT, Math.round(WEIGHT * (1 - normalized))));
  return { score, flag: null };
}
