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
  const sameCity =
    user.city.toLowerCase() === candidate.city.toLowerCase();

  const sameState =
    user.state.toLowerCase() === candidate.state.toLowerCase();

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
