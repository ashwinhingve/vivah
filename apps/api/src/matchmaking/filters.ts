/**
 * Smart Shaadi — Matchmaking Hard Filters
 * Bilateral checks: both the user and the candidate must satisfy each other's preferences.
 */

export interface ProfileWithPreferences {
  id: string
  age: number
  religion: string
  city: string
  state: string
  incomeMin: number
  incomeMax: number
  preferences: {
    ageMin: number
    ageMax: number
    religion: string[]
    openToInterfaith: boolean
    city: string
    state: string
    incomeMin: number
    incomeMax: number
  }
}

/**
 * Apply hard-filters bilaterally.
 * A candidate is kept only when BOTH sides pass every filter.
 */
export function applyHardFilters(
  userProfile: ProfileWithPreferences,
  candidates: ProfileWithPreferences[],
): ProfileWithPreferences[] {
  return candidates.filter((candidate) => passesAllFilters(userProfile, candidate));
}

function passesAllFilters(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  return (
    passesAgeFilter(user, candidate) &&
    passesReligionFilter(user, candidate) &&
    passesLocationFilter(user, candidate) &&
    passesIncomeFilter(user, candidate)
  );
}

// ── Age (bilateral) ──────────────────────────────────────────────────────────

function passesAgeFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  // User's age must be within candidate's accepted range
  const userFitsCandidate =
    user.age >= candidate.preferences.ageMin &&
    user.age <= candidate.preferences.ageMax;

  // Candidate's age must be within user's accepted range
  const candidateFitsUser =
    candidate.age >= user.preferences.ageMin &&
    candidate.age <= user.preferences.ageMax;

  return userFitsCandidate && candidateFitsUser;
}

// ── Religion (bilateral unless either side is open to interfaith) ────────────

function passesReligionFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  // If either party is open to interfaith, skip the check entirely
  if (user.preferences.openToInterfaith || candidate.preferences.openToInterfaith) {
    return true;
  }

  return user.religion === candidate.religion;
}

// ── Location: keep if city OR state matches (case-insensitive) ────────────────

function passesLocationFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  // Empty/missing location on either side = "flexible" — do not hard-filter.
  // Otherwise, require same city or same state (case-insensitive).
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

// ── Income: ranges must overlap ───────────────────────────────────────────────

function passesIncomeFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  // Ranges overlap when: A.min <= B.max AND A.max >= B.min
  return (
    user.incomeMin <= candidate.incomeMax &&
    user.incomeMax >= candidate.incomeMin
  );
}
