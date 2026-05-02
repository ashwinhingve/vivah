import { describe, it, expect } from 'vitest';
import { explainMatch } from '../explainer.js';
import type { CompatibilityScore } from '@smartshaadi/types';
import type { ProfileData } from '../scorer.js';

const u: ProfileData = {
  id: 'u',
  age: 28,
  religion: 'Hindu',
  city: 'Pune',
  state: 'Maharashtra',
  incomeMin: 50000,
  incomeMax: 100000,
  education: 'masters',
  occupation: 'software_engineer',
  familyType: 'NUCLEAR',
  familyValues: 'MODERATE',
  diet: 'VEG',
  smoke: false,
  drink: false,
  preferences: {
    ageMin: 22,
    ageMax: 35,
    religion: ['Hindu'],
    openToInterfaith: false,
    education: [],
    incomeMin: 0,
    incomeMax: 999999,
    familyType: [],
    diet: [],
  },
};

const c: ProfileData = { ...u, id: 'c', age: 27 };

const goodScore: CompatibilityScore = {
  totalScore: 90,
  tier: 'excellent',
  flags: [],
  gunaScore: 30,
  breakdown: {
    demographicAlignment: { score: 18, max: 20 },
    lifestyleCompatibility: { score: 15, max: 15 },
    careerEducation: { score: 12, max: 15 },
    familyValues: { score: 12, max: 15 },
    preferenceOverlap: { score: 18, max: 20 },
    personalityFit: { score: 13, max: 15 },
  },
};

describe('explainMatch', () => {
  it('returns top-3 reasons when many dims fill > 70%', () => {
    const r = explainMatch(u, c, goodScore, 12);
    expect(r.reasons).toHaveLength(3);
    expect(r.caveat).toBeNull();
  });

  it('emits caveat when worst dim < 40%', () => {
    const weak: CompatibilityScore = {
      ...goodScore,
      breakdown: {
        ...goodScore.breakdown,
        familyValues: { score: 4, max: 15 },
      },
    };
    const r = explainMatch(u, c, weak, 12);
    expect(r.caveat).toBeTruthy();
  });

  it('city + distance phrase when sameCity and distance present', () => {
    const r = explainMatch(u, c, goodScore, 8);
    expect(r.reasons.some((x) => /Pune/.test(x))).toBe(true);
  });

  it('no reasons when all dims weak', () => {
    const weak: CompatibilityScore = {
      ...goodScore,
      breakdown: {
        demographicAlignment: { score: 5, max: 20 },
        lifestyleCompatibility: { score: 4, max: 15 },
        careerEducation: { score: 4, max: 15 },
        familyValues: { score: 4, max: 15 },
        preferenceOverlap: { score: 5, max: 20 },
        personalityFit: { score: 4, max: 15 },
      },
    };
    const r = explainMatch(u, c, weak, null);
    expect(r.reasons).toHaveLength(0);
    expect(r.caveat).toBeTruthy();
  });
});
