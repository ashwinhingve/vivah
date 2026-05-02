import { describe, it, expect } from 'vitest';
import { scorePersonality, AXIS_KEYS } from '../personality.js';
import type { PersonalityProfile, PersonalityIdeal } from '@smartshaadi/types';

const same: PersonalityProfile = {
  introvertExtrovert: 4,
  traditionalModern: 4,
  plannerSpontaneous: 4,
  religiousSecular: 4,
  ambitiousBalanced: 4,
  familyIndependent: 4,
};

const allOnes: PersonalityProfile = {
  introvertExtrovert: 1,
  traditionalModern: 1,
  plannerSpontaneous: 1,
  religiousSecular: 1,
  ambitiousBalanced: 1,
  familyIndependent: 1,
};

const allSevens: PersonalityProfile = {
  introvertExtrovert: 7,
  traditionalModern: 7,
  plannerSpontaneous: 7,
  religiousSecular: 7,
  ambitiousBalanced: 7,
  familyIndependent: 7,
};

describe('scorePersonality', () => {
  it('returns 15 for identical profiles', () => {
    const r = scorePersonality(same, same);
    expect(r.score).toBe(15);
    expect(r.flag).toBeNull();
  });

  it('returns 0 for max-distance opposite profiles', () => {
    const r = scorePersonality(allOnes, allSevens);
    expect(r.score).toBe(0);
    expect(r.flag).toBeNull();
  });

  it('returns 7 + flag when one side missing', () => {
    const r = scorePersonality(null, same);
    expect(r.score).toBe(7);
    expect(r.flag).toBe('personality_pending');
  });

  it('returns 7 + flag when both sides missing', () => {
    const r = scorePersonality(null, null);
    expect(r.score).toBe(7);
    expect(r.flag).toBe('personality_pending');
  });

  it('respects per-axis tolerance clipping', () => {
    const candidate: PersonalityProfile = { ...same, introvertExtrovert: 7 };
    const idealTight: PersonalityIdeal = {
      introvertExtrovert: { value: 4, tolerance: 1 },
    };
    const tight = scorePersonality(same, candidate, idealTight);
    const loose = scorePersonality(same, candidate);
    expect(tight.score).toBeGreaterThan(loose.score);
  });

  it('exports 6 axis keys', () => {
    expect(AXIS_KEYS).toHaveLength(6);
  });

  it('returns flag when one axis missing on user', () => {
    const partial = { ...same, introvertExtrovert: undefined } as unknown as PersonalityProfile;
    const r = scorePersonality(partial, same);
    expect(r.flag).toBe('personality_pending');
  });
});
