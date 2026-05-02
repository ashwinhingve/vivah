/**
 * Smart Shaadi — Match explainer.
 * Deterministic top-3 reasons + 1 caveat from CompatibilityBreakdown deltas.
 * No LLM. Pure projection of breakdown ratios → human strings.
 */

import type {
  CompatibilityScore,
  MatchExplainer,
  CompatibilityBreakdown,
} from '@smartshaadi/types';
import type { ProfileData } from './scorer.js';

type DimKey = keyof CompatibilityBreakdown;

const VEG_SET = new Set(['VEG', 'JAIN', 'VEGAN', 'EGGETARIAN']);

const OCC_CAT: Record<string, string> = {
  software_engineer: 'tech',
  developer: 'tech',
  data_scientist: 'tech',
  it_professional: 'tech',
  doctor: 'healthcare',
  nurse: 'healthcare',
  pharmacist: 'healthcare',
  teacher: 'education',
  professor: 'education',
  lawyer: 'legal',
  advocate: 'legal',
  engineer: 'engineering',
  architect: 'engineering',
  businessman: 'business',
  entrepreneur: 'business',
  banker: 'finance',
  accountant: 'finance',
  government: 'government',
  civil_servant: 'government',
};

const occCat = (s: string): string => OCC_CAT[(s ?? '').toLowerCase()] ?? 'other';

function reasonFor(
  dim: DimKey,
  u: ProfileData,
  c: ProfileData,
  distanceKm: number | null,
): string {
  switch (dim) {
    case 'demographicAlignment': {
      const sameCity =
        u.city.toLowerCase() === c.city.toLowerCase() && u.city.length > 0;
      if (sameCity) {
        return distanceKm !== null && distanceKm > 0
          ? `Both in ${u.city}, ${distanceKm}km apart`
          : `Both in ${u.city}`;
      }
      const ageDiff = Math.abs(u.age - c.age);
      if (ageDiff <= 2) return 'Same age group';
      if (u.religion === c.religion) return `Same religion (${u.religion})`;
      return 'Aligned demographics';
    }
    case 'lifestyleCompatibility': {
      if (u.diet === c.diet) return `Both ${u.diet.toLowerCase()}`;
      if (VEG_SET.has(u.diet) && VEG_SET.has(c.diet)) return 'Compatible diets';
      return 'Aligned lifestyle';
    }
    case 'careerEducation':
      if (occCat(u.occupation) === occCat(c.occupation) && occCat(u.occupation) !== 'other') {
        return `Both in ${occCat(u.occupation)}`;
      }
      return 'Similar education level';
    case 'familyValues':
      if (u.familyType === c.familyType) {
        return `Same family setup (${u.familyType.toLowerCase()})`;
      }
      return 'Aligned family values';
    case 'preferenceOverlap':
      return 'Strong preference match';
    case 'personalityFit':
      return 'Compatible personalities';
  }
}

function caveatFor(dim: DimKey): string {
  switch (dim) {
    case 'demographicAlignment':
      return 'Different cities or ages';
    case 'lifestyleCompatibility':
      return 'Different lifestyles';
    case 'careerEducation':
      return 'Different fields/education';
    case 'familyValues':
      return 'Different family setups';
    case 'preferenceOverlap':
      return 'Limited preference overlap';
    case 'personalityFit':
      return 'Different personalities';
  }
}

export function explainMatch(
  user: ProfileData,
  candidate: ProfileData,
  score: CompatibilityScore,
  distanceKm: number | null,
): MatchExplainer {
  const dims = Object.keys(score.breakdown) as DimKey[];

  const ranked = dims
    .map((d) => ({
      d,
      ratio: score.breakdown[d].score / Math.max(1, score.breakdown[d].max),
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const reasons: string[] = [];
  for (const { d, ratio } of ranked) {
    if (ratio < 0.7) break;
    if (reasons.length >= 3) break;
    reasons.push(reasonFor(d, user, candidate, distanceKm));
  }

  const worst = ranked[ranked.length - 1];
  const caveat = worst && worst.ratio < 0.4 ? caveatFor(worst.d) : null;

  return { reasons, caveat };
}
