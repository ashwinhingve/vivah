/**
 * Smart Shaadi — Compatibility Scorer
 * Produces a 0–100 CompatibilityScore for a (user, candidate) pair.
 * Guna score (0–36) is read from Redis; missing key → neutral 18 + flag.
 */

import type {
  CompatibilityScore,
  CompatibilityBreakdown,
  PersonalityProfile,
  MustHaveFlags,
  PersonalityIdeal,
} from '@smartshaadi/types';
import type Redis from 'ioredis';
import { scorePersonality } from './personality.js';

export interface ProfileData {
  id: string
  age: number
  religion: string
  city: string
  state: string
  incomeMin: number
  incomeMax: number
  education: string
  occupation: string
  familyType: string    // 'JOINT' | 'NUCLEAR' | 'EXTENDED'
  familyValues: string  // 'TRADITIONAL' | 'MODERATE' | 'LIBERAL'
  diet: string          // 'VEG' | 'NON_VEG' | 'JAIN' | 'VEGAN' | 'EGGETARIAN'
  smoke: boolean
  drink: boolean
  manglik?: 'YES' | 'NO' | 'PARTIAL' | null
  caste?: string | null
  gotra?: string | null
  gotraExclusionEnabled?: boolean
  community?: string | null
  lastActiveAt?: string | null
  premiumTier?: 'FREE' | 'STANDARD' | 'PREMIUM'
  latitude?: number | null
  longitude?: number | null
  personality?: PersonalityProfile | null
  preferences: {
    ageMin: number
    ageMax: number
    religion: string[]
    openToInterfaith: boolean
    education: string[]
    incomeMin: number
    incomeMax: number
    familyType: string[]
    diet: string[]
    manglik?: 'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK'
    openToInterCaste?: boolean
    maxDistanceKm?: number
    mustHave?: MustHaveFlags
    personalityIdeal?: PersonalityIdeal
  }
}

// ── Education tiers (higher index = higher tier) ─────────────────────────────

const EDUCATION_TIERS: Record<string, number> = {
  'below_10th':    0,
  '10th':          1,
  '12th':          2,
  'diploma':       3,
  'bachelors':     4,
  'graduate':      4,
  'masters':       5,
  'postgraduate':  5,
  'phd':           6,
  'doctorate':     6,
  'mbbs':          5,
  'ca':            5,
  'cs':            5,
};

function educationTier(education: string): number {
  return EDUCATION_TIERS[education.toLowerCase()] ?? 3;
}

// ── Occupation categories ────────────────────────────────────────────────────

const OCCUPATION_CATEGORIES: Record<string, string> = {
  software_engineer: 'tech',
  developer:         'tech',
  data_scientist:    'tech',
  it_professional:   'tech',
  doctor:            'healthcare',
  nurse:             'healthcare',
  pharmacist:        'healthcare',
  teacher:           'education',
  professor:         'education',
  lawyer:            'legal',
  advocate:          'legal',
  engineer:          'engineering',
  architect:         'engineering',
  businessman:       'business',
  entrepreneur:      'business',
  banker:            'finance',
  accountant:        'finance',
  government:        'government',
  civil_servant:     'government',
};

function occupationCategory(occupation: string): string {
  return OCCUPATION_CATEGORIES[occupation.toLowerCase()] ?? 'other';
}

// ── Income bracket ───────────────────────────────────────────────────────────

function incomeBracket(min: number, max: number): number {
  const mid = (min + max) / 2;
  if (mid >= 200000) return 5;
  if (mid >= 100000) return 4;
  if (mid >= 60000)  return 3;
  if (mid >= 30000)  return 2;
  if (mid >= 10000)  return 1;
  return 0;
}

// ── Scoring dimensions ───────────────────────────────────────────────────────

function scoreDemographicAlignment(
  user: ProfileData,
  candidate: ProfileData,
): number {
  let score = 0;

  // Age closeness (max 10)
  const ageDiff = Math.abs(user.age - candidate.age);
  if (ageDiff <= 2)      score += 10;
  else if (ageDiff <= 4) score += 7;
  else if (ageDiff <= 7) score += 4;
  else if (ageDiff <= 10) score += 2;

  // Religion (max 8)
  if (user.religion === candidate.religion) score += 8;

  // Location (max 6 → split city/state, but cap dimension at 25)
  const sameCity  = user.city.toLowerCase() === candidate.city.toLowerCase();
  const sameState = user.state.toLowerCase() === candidate.state.toLowerCase();
  if (sameCity)        score += 4;
  else if (sameState)  score += 2;

  // Income overlap (max 3)
  const userBracket = incomeBracket(user.incomeMin, user.incomeMax);
  const candBracket = incomeBracket(candidate.incomeMin, candidate.incomeMax);
  if (userBracket === candBracket)              score += 3;
  else if (Math.abs(userBracket - candBracket) === 1) score += 1;

  return Math.min(score, 20);
}

function scoreLifestyleCompatibility(
  user: ProfileData,
  candidate: ProfileData,
): number {
  let score = 0;

  // Diet match (max 8)
  if (user.diet === candidate.diet) score += 8;
  else {
    // Partial: both veg-spectrum (VEG, JAIN, VEGAN, EGGETARIAN)
    const vegSpectrum = new Set(['VEG', 'JAIN', 'VEGAN', 'EGGETARIAN']);
    if (vegSpectrum.has(user.diet) && vegSpectrum.has(candidate.diet)) score += 4;
  }

  // Smoking (max 5)
  if (user.smoke === candidate.smoke) score += 5;

  // Drinking (max 5)
  if (user.drink === candidate.drink) score += 5;

  return Math.min(score, 15);
}

function scoreCareerEducation(
  user: ProfileData,
  candidate: ProfileData,
): number {
  let score = 0;

  // Education tier compatibility (max 8)
  const userTier = educationTier(user.education);
  const candTier = educationTier(candidate.education);
  const tierDiff = Math.abs(userTier - candTier);
  if (tierDiff === 0)      score += 8;
  else if (tierDiff === 1) score += 5;
  else if (tierDiff === 2) score += 2;

  // Occupation category match (max 4)
  if (occupationCategory(user.occupation) === occupationCategory(candidate.occupation)) {
    score += 4;
  }

  // Income bracket proximity (max 3)
  const userBracket = incomeBracket(user.incomeMin, user.incomeMax);
  const candBracket = incomeBracket(candidate.incomeMin, candidate.incomeMax);
  if (userBracket === candBracket)                    score += 3;
  else if (Math.abs(userBracket - candBracket) === 1) score += 1;

  return Math.min(score, 15);
}

function scoreFamilyValues(
  user: ProfileData,
  candidate: ProfileData,
): number {
  let score = 0;

  // Family type match (max 8)
  if (user.familyType === candidate.familyType) score += 8;

  // Family values match (max 8)
  if (user.familyValues === candidate.familyValues) score += 8;
  else {
    // Adjacent values (e.g. moderate ↔ traditional or moderate ↔ liberal)
    const valueOrder = ['TRADITIONAL', 'MODERATE', 'LIBERAL'];
    const uIdx = valueOrder.indexOf(user.familyValues.toUpperCase());
    const cIdx = valueOrder.indexOf(candidate.familyValues.toUpperCase());
    if (uIdx !== -1 && cIdx !== -1 && Math.abs(uIdx - cIdx) === 1) score += 4;
  }

  return Math.min(score, 15);
}

function scorePreferenceOverlap(
  user: ProfileData,
  candidate: ProfileData,
): number {
  // How many of the user's key preferences does the candidate satisfy?
  let met = 0;
  let total = 0;

  // Religion preference
  total++;
  if (user.preferences.religion.length === 0) {
    met += 0.5;
  } else if (user.preferences.openToInterfaith || user.preferences.religion.includes(candidate.religion)) {
    met++;
  }

  // Education preference
  total++;
  if (user.preferences.education.length === 0) {
    met += 0.5;
  } else if (user.preferences.education.includes(candidate.education)) {
    met++;
  }

  // Income preference
  total++;
  const incomeOverlap =
    candidate.incomeMin <= user.preferences.incomeMax &&
    candidate.incomeMax >= user.preferences.incomeMin;
  if (incomeOverlap) met++;

  // Family type preference
  total++;
  if (user.preferences.familyType.length === 0) {
    met += 0.5;
  } else if (user.preferences.familyType.includes(candidate.familyType)) {
    met++;
  }

  // Diet preference
  total++;
  if (user.preferences.diet.length === 0) {
    met += 0.5;
  } else if (user.preferences.diet.includes(candidate.diet)) {
    met++;
  }

  const ratio = total > 0 ? met / total : 0;
  return Math.round(ratio * 20);
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function scoreCandidate(
  _userId: string,
  _candidateId: string,
  userProfile: ProfileData,
  candidateProfile: ProfileData,
  redis: Redis,
): Promise<CompatibilityScore> {
  const flags: string[] = [];

  // Compute dimension scores
  const demographicScore     = scoreDemographicAlignment(userProfile, candidateProfile);
  const lifestyleScore       = scoreLifestyleCompatibility(userProfile, candidateProfile);
  const careerScore          = scoreCareerEducation(userProfile, candidateProfile);
  const familyScore          = scoreFamilyValues(userProfile, candidateProfile);
  const preferenceScore      = scorePreferenceOverlap(userProfile, candidateProfile);
  const personalityResult    = scorePersonality(
    userProfile.personality ?? null,
    candidateProfile.personality ?? null,
    userProfile.preferences.personalityIdeal,
  );
  if (personalityResult.flag) flags.push(personalityResult.flag);

  // Guna score from Redis
  const [idA, idB] = [userProfile.id, candidateProfile.id].sort();
  const redisKey   = `match_scores:${idA}:${idB}`;
  const raw        = await redis.get(redisKey);

  let gunaScore: number;
  if (raw === null) {
    gunaScore = 18; // neutral default
    flags.push('guna_pending');
  } else {
    const parsed = Number(raw);
    gunaScore = Number.isNaN(parsed) ? 18 : Math.max(0, Math.min(36, parsed));
    if (Number.isNaN(parsed)) flags.push('guna_parse_error');
  }

  // Normalise guna to 0–5 bonus
  const gunaBonus = Math.round((gunaScore / 36) * 5);

  const breakdown: CompatibilityBreakdown = {
    demographicAlignment:   { score: demographicScore,        max: 20 },
    lifestyleCompatibility: { score: lifestyleScore,          max: 15 },
    careerEducation:        { score: careerScore,             max: 15 },
    familyValues:           { score: familyScore,             max: 15 },
    preferenceOverlap:      { score: preferenceScore,         max: 20 },
    personalityFit:         { score: personalityResult.score, max: 15 },
  };

  const rawTotal =
    demographicScore + lifestyleScore + careerScore + familyScore +
    preferenceScore + personalityResult.score + gunaBonus;
  const totalScore = Math.min(100, rawTotal);

  let tier: CompatibilityScore['tier'];
  if (totalScore >= 75)      tier = 'excellent';
  else if (totalScore >= 55) tier = 'good';
  else if (totalScore >= 35) tier = 'average';
  else                       tier = 'low';

  return {
    totalScore,
    breakdown,
    gunaScore,
    tier,
    flags,
  };
}
