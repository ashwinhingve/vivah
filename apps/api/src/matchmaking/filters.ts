/**
 * Smart Shaadi — Matchmaking Hard Filters
 * Bilateral checks: both the user and the candidate must satisfy each other's preferences.
 */

import type { MustHaveFlags } from '@smartshaadi/types';
import { haversineKm } from '../lib/geocode.js';
import { passesMaritalStatusFilter, type MaritalStatusValue } from './filters/maritalStatusFilter.js';

export type GenderValue = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER'

export interface ProfileWithPreferences {
  id: string
  age: number
  gender?: GenderValue | null
  religion: string
  city: string
  state: string
  incomeMin: number
  incomeMax: number
  manglik?: 'YES' | 'NO' | 'PARTIAL' | null
  caste?: string | null
  gotra?: string | null
  gotraExclusionEnabled?: boolean
  latitude?: number | null
  longitude?: number | null
  education?: string
  diet?: string
  maritalStatus?: MaritalStatusValue | null
  preferredMaritalStatuses?: MaritalStatusValue[] | null
  divorceeSupport?: boolean
  preferences: {
    ageMin: number
    ageMax: number
    religion: string[]
    openToInterfaith: boolean
    city: string
    state: string
    incomeMin: number
    incomeMax: number
    manglik?: 'ANY' | 'ONLY_MANGLIK' | 'NON_MANGLIK'
    openToInterCaste?: boolean
    maxDistanceKm?: number
    mustHave?: MustHaveFlags
    education?: string[]
    diet?: string[]
    partnerGender?: GenderValue[]
  }
}

/**
 * Apply hard-filters bilaterally.
 * A candidate is kept only when BOTH sides pass every filter.
 *
 * `lgbtqEnabled` controls passesGenderFilter behavior:
 *   - false (default platform state): only MALE <-> FEMALE pairs are allowed,
 *     and NON_BINARY/OTHER users are excluded from the gender filter step.
 *   - true: each side's preferredGender list is honored bilaterally.
 */
export function applyHardFilters(
  userProfile: ProfileWithPreferences,
  candidates: ProfileWithPreferences[],
  options: { lgbtqEnabled?: boolean } = {},
): ProfileWithPreferences[] {
  const lgbtqEnabled = options.lgbtqEnabled === true;
  return candidates.filter((candidate) =>
    passesAllFilters(userProfile, candidate, lgbtqEnabled),
  );
}

function passesAllFilters(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
  lgbtqEnabled: boolean,
): boolean {
  return (
    passesGenderFilter(user, candidate, lgbtqEnabled) &&
    passesAgeFilter(user, candidate) &&
    passesReligionFilter(user, candidate) &&
    passesDistanceFilter(user, candidate) &&
    passesIncomeFilter(user, candidate) &&
    passesEducationFilter(user, candidate) &&
    passesDietFilter(user, candidate) &&
    passesCasteFilter(user, candidate) &&
    passesGotraFilter(user, candidate) &&
    passesManglikFilter(user, candidate) &&
    passesMaritalStatusFilter(user, candidate)
  );
}

// -- Gender filter (bilateral) --------------------------------------------
//
// Flag off  : only MALE<->FEMALE pairs pass. Anyone whose gender is missing
//             or NON_BINARY/OTHER is dropped. preferredGender is ignored.
// Flag on   : both sides' partnerGender arrays must include each other's
//             gender. Missing partnerGender defaults to "opposite of self"
//             so existing users behave like the flag-off case.
export function passesGenderFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
  lgbtqEnabled: boolean,
): boolean {
  const userG = user.gender ?? null;
  const candG = candidate.gender ?? null;
  if (!userG || !candG) return false;

  if (!lgbtqEnabled) {
    const allowed: Array<[GenderValue, GenderValue]> = [
      ['MALE', 'FEMALE'],
      ['FEMALE', 'MALE'],
    ];
    return allowed.some(([a, b]) => a === userG && b === candG);
  }

  const fallback = (g: GenderValue): GenderValue[] =>
    g === 'MALE' ? ['FEMALE']
    : g === 'FEMALE' ? ['MALE']
    : ['MALE', 'FEMALE'];
  const userWants = user.preferences.partnerGender && user.preferences.partnerGender.length > 0
    ? user.preferences.partnerGender
    : fallback(userG);
  const candWants = candidate.preferences.partnerGender && candidate.preferences.partnerGender.length > 0
    ? candidate.preferences.partnerGender
    : fallback(candG);

  return userWants.includes(candG) && candWants.includes(userG);
}

// ── Age (bilateral) ──────────────────────────────────────────────────────────

function passesAgeFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userFitsCandidate =
    user.age >= candidate.preferences.ageMin &&
    user.age <= candidate.preferences.ageMax;

  const candidateFitsUser =
    candidate.age >= user.preferences.ageMin &&
    candidate.age <= user.preferences.ageMax;

  return userFitsCandidate && candidateFitsUser;
}

// ── Religion (bilateral; mustHave.religion overrides openToInterfaith) ───────

function passesReligionFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const mustHave =
    user.preferences.mustHave?.religion === true ||
    candidate.preferences.mustHave?.religion === true;
  if (!mustHave && (user.preferences.openToInterfaith || candidate.preferences.openToInterfaith)) {
    return true;
  }
  return user.religion === candidate.religion;
}

// ── Distance (haversine when coords present, city/state fallback otherwise) ──

function passesDistanceFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userMust      = user.preferences.mustHave?.distance      === true;
  const candidateMust = candidate.preferences.mustHave?.distance === true;
  const userMax       = user.preferences.maxDistanceKm      ?? 100;
  const candidateMax  = candidate.preferences.maxDistanceKm ?? 100;
  const limit = Math.min(userMax, candidateMax);

  const haveCoords =
    typeof user.latitude === 'number' && typeof user.longitude === 'number' &&
    typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number';

  if (haveCoords) {
    const km = haversineKm(
      { lat: user.latitude as number, lng: user.longitude as number },
      { lat: candidate.latitude as number, lng: candidate.longitude as number },
    );
    return km <= limit;
  }

  // No coords → if either side mustHave.distance, hard-fail
  if (userMust || candidateMust) return false;

  // Fallback: city or state must match
  const uCity  = user.city?.trim().toLowerCase()      ?? '';
  const cCity  = candidate.city?.trim().toLowerCase() ?? '';
  const uState = user.state?.trim().toLowerCase()     ?? '';
  const cState = candidate.state?.trim().toLowerCase() ?? '';
  if (!uCity && !uState) return true;
  if (!cCity && !cState) return true;
  const sameCity  = uCity  !== '' && uCity  === cCity;
  const sameState = uState !== '' && uState === cState;
  return sameCity || sameState;
}

// ── Income (bilateral preference vs own income) ──────────────────────────────
//
// Each side's partnerPreferences.incomeRange specifies what *partner* income is
// acceptable. The check is bilateral: candidate's own income must overlap user's
// pref range AND user's own income must overlap candidate's pref range.
//
// preferences.incomeMin/Max default to {0, 999999} when no range is set
// (parseIncomeRange in engine.ts), making the filter permissive by default.

function passesIncomeFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userPrefVsCandIncome =
    candidate.incomeMax >= user.preferences.incomeMin &&
    candidate.incomeMin <= user.preferences.incomeMax;
  const candPrefVsUserIncome =
    user.incomeMax >= candidate.preferences.incomeMin &&
    user.incomeMin <= candidate.preferences.incomeMax;
  return userPrefVsCandIncome && candPrefVsUserIncome;
}

// ── Education (mustHave-gated) ───────────────────────────────────────────────

function passesEducationFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userMust      = user.preferences.mustHave?.education      === true;
  const candidateMust = candidate.preferences.mustHave?.education === true;
  if (!userMust && !candidateMust) return true;

  if (userMust && Array.isArray(user.preferences.education) && user.preferences.education.length > 0) {
    if (!user.preferences.education.includes(candidate.education ?? '')) return false;
  }
  if (candidateMust && Array.isArray(candidate.preferences.education) && candidate.preferences.education.length > 0) {
    if (!candidate.preferences.education.includes(user.education ?? '')) return false;
  }
  return true;
}

// ── Diet (mustHave-gated) ────────────────────────────────────────────────────

function passesDietFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userMust      = user.preferences.mustHave?.diet      === true;
  const candidateMust = candidate.preferences.mustHave?.diet === true;
  if (!userMust && !candidateMust) return true;

  if (userMust && Array.isArray(user.preferences.diet) && user.preferences.diet.length > 0) {
    if (!user.preferences.diet.includes(candidate.diet ?? '')) return false;
  }
  if (candidateMust && Array.isArray(candidate.preferences.diet) && candidate.preferences.diet.length > 0) {
    if (!candidate.preferences.diet.includes(user.diet ?? '')) return false;
  }
  return true;
}

// ── Caste (mustHave.caste overrides openToInterCaste) ────────────────────────

function passesCasteFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const u = (user.caste ?? '').trim().toLowerCase();
  const c = (candidate.caste ?? '').trim().toLowerCase();
  if (!u || !c) return true;
  const mustHave =
    user.preferences.mustHave?.caste === true ||
    candidate.preferences.mustHave?.caste === true;
  if (!mustHave && (user.preferences.openToInterCaste || candidate.preferences.openToInterCaste)) return true;
  return u === c;
}

// ── Gotra (sapinda exclusion; both must opt in) ──────────────────────────────

function passesGotraFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const u = (user.gotra ?? '').trim().toLowerCase();
  const c = (candidate.gotra ?? '').trim().toLowerCase();
  if (!u || !c) return true;
  if (user.gotraExclusionEnabled === false || candidate.gotraExclusionEnabled === false) return true;
  return u !== c;
}

// ── Manglik (Hindu-only; mustHave.manglik flips default to NON_MANGLIK) ──────

function passesManglikFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const pref = user.preferences.manglik;
  const mustHave = user.preferences.mustHave?.manglik === true;
  const effective = pref ?? (mustHave ? 'NON_MANGLIK' : 'ANY');
  if (effective === 'ANY') return true;
  // Manglik is Hindu-only. Skip when religion differs or non-Hindu.
  const uRel = (user.religion ?? '').toLowerCase();
  const cRel = (candidate.religion ?? '').toLowerCase();
  if (uRel !== 'hindu' || cRel !== 'hindu') return true;
  const candidateIsManglik = candidate.manglik === 'YES' || candidate.manglik === 'PARTIAL';
  if (effective === 'ONLY_MANGLIK')   return candidateIsManglik;
  if (effective === 'NON_MANGLIK')    return candidate.manglik === 'NO';
  return true;
}
