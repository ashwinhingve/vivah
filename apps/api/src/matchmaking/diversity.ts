/**
 * Smart Shaadi — MMR diversity reranker.
 * Re-orders top-N candidates so the feed doesn't collapse onto a single
 * caste/occupation/city cluster. λ trades relevance vs diversity.
 */

import type { CompatibilityScore } from '@smartshaadi/types';

export interface ClusterableItem {
  profileId: string;
  compatibility: CompatibilityScore;
  _clusterKeys: string[];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function mmrRerank<T extends ClusterableItem>(
  items: T[],
  lambda: number = 0.7,
  k: number = 50,
): T[] {
  if (items.length === 0) return items;
  const sorted = [...items].sort(
    (a, b) => b.compatibility.totalScore - a.compatibility.totalScore,
  );
  const picked: T[] = [];
  const remaining = sorted.slice();
  picked.push(remaining.shift() as T);

  while (picked.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i] as T;
      const relevance = cand.compatibility.totalScore / 100;
      let maxSim = 0;
      for (const p of picked) {
        const sim = jaccard(cand._clusterKeys, p._clusterKeys);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }
    picked.push(remaining.splice(bestIdx, 1)[0] as T);
  }
  return picked;
}

export function buildClusterKeys(opts: {
  caste?: string | null;
  occupationCategory?: string | null;
  city?: string | null;
  age?: number | null;
}): string[] {
  const keys: string[] = [];
  if (opts.caste) keys.push(`caste:${opts.caste.toLowerCase()}`);
  if (opts.occupationCategory) {
    keys.push(`occ:${opts.occupationCategory.toLowerCase()}`);
  }
  if (opts.city) keys.push(`city:${opts.city.toLowerCase()}`);
  if (typeof opts.age === 'number' && opts.age > 0) {
    keys.push(`age:${Math.floor(opts.age / 5)}`);
  }
  return keys;
}
