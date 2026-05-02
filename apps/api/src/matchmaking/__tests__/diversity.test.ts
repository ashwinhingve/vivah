import { describe, it, expect } from 'vitest';
import { mmrRerank, buildClusterKeys, type ClusterableItem } from '../diversity.js';
import type { CompatibilityScore } from '@smartshaadi/types';

function mk(id: string, score: number, cluster: string[]): ClusterableItem {
  const compatibility: CompatibilityScore = {
    totalScore: score,
    tier: 'good',
    flags: [],
    gunaScore: 18,
    breakdown: {
      demographicAlignment: { score: 0, max: 20 },
      lifestyleCompatibility: { score: 0, max: 15 },
      careerEducation: { score: 0, max: 15 },
      familyValues: { score: 0, max: 15 },
      preferenceOverlap: { score: 0, max: 20 },
      personalityFit: { score: 0, max: 15 },
    },
  };
  return { profileId: id, compatibility, _clusterKeys: cluster };
}

describe('mmrRerank', () => {
  it('λ=1 keeps pure score order', () => {
    const items = [mk('a', 90, ['x']), mk('b', 80, ['x']), mk('c', 70, ['y'])];
    const out = mmrRerank(items, 1.0);
    expect(out.map((i) => i.profileId)).toEqual(['a', 'b', 'c']);
  });

  it('λ=0.7 prefers diversity when scores close', () => {
    const items = [mk('a', 90, ['x']), mk('b', 88, ['x']), mk('c', 85, ['y'])];
    const out = mmrRerank(items, 0.7);
    expect(out[0]!.profileId).toBe('a');
    expect(out[1]!.profileId).toBe('c');
  });

  it('λ=0 ignores score, maximizes diversity', () => {
    const items = [mk('a', 90, ['x']), mk('b', 50, ['y']), mk('c', 80, ['x'])];
    const out = mmrRerank(items, 0.0);
    expect(out[1]!.profileId).toBe('b');
  });

  it('respects k cap', () => {
    const items = Array.from({ length: 10 }, (_, i) => mk(`p${i}`, 90 - i, ['x']));
    expect(mmrRerank(items, 0.7, 3)).toHaveLength(3);
  });

  it('handles empty list', () => {
    expect(mmrRerank([], 0.7)).toEqual([]);
  });
});

describe('buildClusterKeys', () => {
  it('omits null/undefined fields', () => {
    expect(buildClusterKeys({ caste: 'Brahmin' })).toEqual(['caste:brahmin']);
  });

  it('buckets age by 5', () => {
    expect(buildClusterKeys({ age: 27 })).toEqual(['age:5']);
    expect(buildClusterKeys({ age: 31 })).toEqual(['age:6']);
  });

  it('returns full key set', () => {
    expect(
      buildClusterKeys({
        caste: 'Iyer',
        occupationCategory: 'tech',
        city: 'Pune',
        age: 28,
      }),
    ).toEqual(['caste:iyer', 'occ:tech', 'city:pune', 'age:5']);
  });
});
