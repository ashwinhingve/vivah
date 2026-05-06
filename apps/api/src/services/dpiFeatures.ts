/**
 * dpiFeatures.ts — Feature extraction for the Divorce Probability Indicator.
 *
 * Extracts 10 normalized [0, 1] features from PostgreSQL profile data and Redis
 * cached values (emotional score, guna milan score). All values are HIGHER =
 * MORE risk (the Python model interprets each feature as a risk factor).
 *
 * The function MUST be deterministic for the same inputs (same profiles →
 * same feature vector every time). Caching depends on this guarantee.
 */
import { redis } from '../lib/redis.js';

// ── Profile types (minimal, inferred from ProfileContent MongoDB schema) ──────

export interface DpiProfileContent {
  personal?: {
    dob?: Date | string | null;
    religion?: string | null;
  };
  education?: {
    degree?: string | null;
  };
  profession?: {
    incomeRange?: string | null;
  };
  family?: {
    familyValues?: string | null;
  };
  lifestyle?: {
    diet?: string | null;
    smoking?: string | null;
    drinking?: string | null;
    interests?: string[];
    hyperNicheTags?: string[];
  };
  horoscope?: {
    gunaScore?: number | null;
  };
  partnerPreferences?: {
    ageRange?: { min?: number; max?: number } | null;
    education?: string[] | null;
    religion?: string[] | null;
    caste?: string[] | null;
    diet?: string[] | null;
    openToInterfaith?: boolean;
    openToInterCaste?: boolean;
    location?: string[] | null;
  };
  communityZone?: string | null;
}

export interface DpiProfile {
  id: string;          // profiles.id (PostgreSQL)
  userId: string;      // user.id (Better Auth)
  latitude?: string | null;
  longitude?: string | null;
  content: DpiProfileContent;  // always an object; callers use `?? {}` when unknown
}

export interface DpiFeatures {
  age_gap_years: number;
  education_gap: number;
  income_disparity_pct: number;
  family_values_alignment: number;
  lifestyle_compatibility: number;
  communication_score: number;
  guna_milan_score: number;
  geographic_distance_km: number;
  religion_caste_match: number;
  preference_match_pct: number;
}

// ── Education ladder (higher index = higher education level) ─────────────────

const EDUCATION_RANK: Record<string, number> = {
  'HIGH_SCHOOL':     0,
  'DIPLOMA':         1,
  'BACHELORS':       2,
  'GRADUATE':        2,
  'MASTERS':         3,
  'POST_GRADUATE':   3,
  'MBA':             3,
  'MD':              4,
  'PHD':             4,
  'DOCTORATE':       4,
};

function educationRank(degree?: string | null): number {
  if (!degree) return 2; // default to BACHELORS level
  const upper = degree.toUpperCase().trim();
  // Fuzzy match common degree strings
  if (upper.includes('PHD') || upper.includes('DOCTORATE')) return 4;
  if (upper.includes('MD') || upper.includes('MEDICAL')) return 4;
  if (upper.includes('MASTER') || upper.includes('MBA') || upper.includes('M.TECH') || upper.includes('M.SC') || upper.includes('POST GRAD')) return 3;
  if (upper.includes('BACHELOR') || upper.includes('B.TECH') || upper.includes('B.SC') || upper.includes('B.COM') || upper.includes('GRAD')) return 2;
  if (upper.includes('DIPLOMA')) return 1;
  if (upper.includes('HIGH SCHOOL') || upper.includes('12TH') || upper.includes('MATRIC')) return 0;
  return EDUCATION_RANK[upper] ?? 2;
}

// ── Income range parser (extracts midpoint in LPA) ───────────────────────────

function parseMidIncomeLPA(range?: string | null): number {
  if (!range) return 5; // default 5 LPA
  // Format: "5-10 LPA" or "10-20 LPA" or "25+ LPA"
  const match25Plus = range.match(/(\d+)\s*\+/);
  if (match25Plus) return parseInt(match25Plus[1] ?? '25', 10) + 5;
  const matchRange = range.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (matchRange) {
    const lo = parseInt(matchRange[1] ?? '5', 10);
    const hi = parseInt(matchRange[2] ?? '10', 10);
    return (lo + hi) / 2;
  }
  const matchSingle = range.match(/(\d+)/);
  if (matchSingle) return parseInt(matchSingle[1] ?? '5', 10);
  return 5;
}

// ── Haversine distance (km) ───────────────────────────────────────────────────

function haversineKm(
  lat1?: string | null,
  lon1?: string | null,
  lat2?: string | null,
  lon2?: string | null,
): number | null {
  const R = 6371; // Earth radius km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a1 = parseFloat(lat1 ?? '');
  const o1 = parseFloat(lon1 ?? '');
  const a2 = parseFloat(lat2 ?? '');
  const o2 = parseFloat(lon2 ?? '');
  if ([a1, o1, a2, o2].some(Number.isNaN)) return null;
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const a =
    sinDLat * sinDLat +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Band km→[0,1] risk. Same city=0, adjacent=0.1, same state=0.3, India=0.5,
 *  cross-border=0.7, very far (>3000km)=1.0. */
function distanceBand(km: number | null): number {
  if (km === null) return 0.5; // unknown → neutral
  if (km < 50) return 0.0;
  if (km < 300) return 0.1;
  if (km < 800) return 0.3;
  if (km < 2000) return 0.5;
  if (km < 4000) return 0.7;
  return 1.0;
}

// ── Main extractFeatures ──────────────────────────────────────────────────────

/**
 * Extract 10 normalized [0, 1] risk features from two profiles.
 * Higher values = MORE risk. Deterministic for same inputs.
 *
 * @param profileA  Requesting user's profile (enriched with MongoDB content)
 * @param profileB  Other user's profile (enriched with MongoDB content)
 * @param matchId   Used to look up cached emotional score in Redis
 */
export async function extractFeatures(
  profileA: DpiProfile,
  profileB: DpiProfile,
  matchId: string,
): Promise<DpiFeatures> {
  // ── 1. Age gap ─────────────────────────────────────────────────────────────
  let age_gap_years = 0.5; // default if DOB missing
  const dobA = profileA.content?.personal?.dob;
  const dobB = profileB.content?.personal?.dob;
  if (dobA && dobB) {
    const msPerYear = 365.25 * 24 * 3600 * 1000;
    const ageA = (Date.now() - new Date(dobA).getTime()) / msPerYear;
    const ageB = (Date.now() - new Date(dobB).getTime()) / msPerYear;
    const gap = Math.abs(ageA - ageB);
    // Band: 0-3yr=0.0, 3-7yr=0.3, 7-12yr=0.6, >12yr=1.0
    if (gap < 3) age_gap_years = 0.0;
    else if (gap < 7) age_gap_years = 0.3;
    else if (gap < 12) age_gap_years = 0.6;
    else age_gap_years = 1.0;
  }

  // ── 2. Education gap ───────────────────────────────────────────────────────
  const rankA = educationRank(profileA.content?.education?.degree);
  const rankB = educationRank(profileB.content?.education?.degree);
  const eduDiff = Math.abs(rankA - rankB);
  let education_gap: number;
  if (eduDiff === 0) education_gap = 0.0;       // SAME
  else if (eduDiff === 1) education_gap = 0.3;  // ONE_STEP
  else if (eduDiff === 2) education_gap = 0.6;  // TWO_STEP
  else education_gap = 1.0;                     // LARGE_GAP (3+ levels)

  // ── 3. Income disparity ────────────────────────────────────────────────────
  const incomeA = parseMidIncomeLPA(profileA.content?.profession?.incomeRange);
  const incomeB = parseMidIncomeLPA(profileB.content?.profession?.incomeRange);
  let income_disparity_pct: number;
  if (incomeA === 0 && incomeB === 0) {
    income_disparity_pct = 0.0;
  } else {
    const maxIncome = Math.max(incomeA, incomeB);
    income_disparity_pct = Math.min(1.0, Math.abs(incomeA - incomeB) / maxIncome);
  }

  // ── 4. Family values alignment (mismatch = risk) ───────────────────────────
  const fvA = profileA.content?.family?.familyValues ?? '';
  const fvB = profileB.content?.family?.familyValues ?? '';
  // Map to numeric scale: TRADITIONAL=0, MODERATE=1, LIBERAL=2
  const FV_RANK: Record<string, number> = { TRADITIONAL: 0, MODERATE: 1, LIBERAL: 2 };
  const fvRankA = FV_RANK[fvA] ?? 1;
  const fvRankB = FV_RANK[fvB] ?? 1;
  const fvDiff = Math.abs(fvRankA - fvRankB);
  // Scale 0→0.0, 1→0.5, 2→1.0
  const family_values_alignment = fvDiff / 2;

  // ── 5. Lifestyle compatibility ─────────────────────────────────────────────
  // Weighted mismatches: diet(0.4) + smoking(0.3) + drinking(0.3)
  const dietA = profileA.content?.lifestyle?.diet ?? '';
  const dietB = profileB.content?.lifestyle?.diet ?? '';
  const smokingA = profileA.content?.lifestyle?.smoking ?? '';
  const smokingB = profileB.content?.lifestyle?.smoking ?? '';
  const drinkingA = profileA.content?.lifestyle?.drinking ?? '';
  const drinkingB = profileB.content?.lifestyle?.drinking ?? '';

  const dietMismatch = dietA && dietB && dietA !== dietB ? 1 : 0;
  // Smoking/drinking mismatch: NEVER vs REGULARLY = full; NEVER vs OCCASIONALLY = 0.5
  function smokeDrinkRisk(a: string, b: string): number {
    if (!a || !b || a === b) return 0;
    const ranks: Record<string, number> = { NEVER: 0, OCCASIONALLY: 1, REGULARLY: 2 };
    const diff = Math.abs((ranks[a] ?? 1) - (ranks[b] ?? 1));
    return diff === 2 ? 1.0 : 0.5;
  }
  const smokeMismatch = smokeDrinkRisk(smokingA, smokingB);
  const drinkMismatch = smokeDrinkRisk(drinkingA, drinkingB);
  const lifestyle_compatibility = Math.min(
    1.0,
    dietMismatch * 0.4 + smokeMismatch * 0.3 + drinkMismatch * 0.3,
  );

  // ── 6. Communication score (from Redis emotional score) ───────────────────
  let communication_score = 0.5; // default if not cached
  try {
    const emotionalCached = await redis.get(`emotional:${matchId}`);
    if (emotionalCached) {
      const parsed = JSON.parse(emotionalCached) as { score?: number };
      if (typeof parsed.score === 'number') {
        // Emotional score is 0-100 where 100 = very warm (good).
        // We convert to risk: higher emotional score = lower communication risk.
        communication_score = (100 - parsed.score) / 100;
      }
    }
  } catch {
    // Non-fatal — use default 0.5
  }

  // ── 7. Guna Milan score ────────────────────────────────────────────────────
  let guna_milan_score = 0.5; // default if not computed
  const gunaRaw = profileA.content?.horoscope?.gunaScore;
  if (typeof gunaRaw === 'number' && gunaRaw >= 0 && gunaRaw <= 36) {
    // Guna 36 = perfect (0 risk), Guna 0 = terrible (1.0 risk)
    guna_milan_score = (36 - gunaRaw) / 36;
  }

  // ── 8. Geographic distance ─────────────────────────────────────────────────
  const km = haversineKm(
    profileA.latitude,
    profileA.longitude,
    profileB.latitude,
    profileB.longitude,
  );
  const geographic_distance_km = distanceBand(km);

  // ── 9. Religion/caste match ────────────────────────────────────────────────
  const religionA = (profileA.content?.personal?.religion ?? '').toUpperCase();
  const religionB = (profileB.content?.personal?.religion ?? '').toUpperCase();
  const communityA = (profileA.content?.communityZone ?? '').toUpperCase();
  const communityB = (profileB.content?.communityZone ?? '').toUpperCase();
  const prefInterfaithA = profileA.content?.partnerPreferences?.openToInterfaith ?? false;
  const prefInterfaithB = profileB.content?.partnerPreferences?.openToInterfaith ?? false;

  let religion_caste_match: number;
  if (!religionA || !religionB || religionA === religionB) {
    // Same religion — check community
    if (!communityA || !communityB || communityA === communityB) {
      religion_caste_match = 0.0; // SAME
    } else {
      religion_caste_match = prefInterfaithA || prefInterfaithB ? 0.4 : 0.4; // COMPATIBLE (same religion, different community)
    }
  } else {
    // Different religions
    religion_caste_match = prefInterfaithA && prefInterfaithB ? 0.4 : 0.8; // DIFFERENT
  }

  // ── 10. Preference match percentage ───────────────────────────────────────
  // How many of A's stated preferences does B NOT satisfy (risk = mismatch)
  let matched = 0;
  let total = 0;

  // Age preference
  const prefAge = profileA.content?.partnerPreferences?.ageRange;
  const dobBDate = profileB.content?.personal?.dob;
  if (prefAge && dobBDate) {
    const msPerYear = 365.25 * 24 * 3600 * 1000;
    const ageB = (Date.now() - new Date(dobBDate).getTime()) / msPerYear;
    total++;
    if ((!prefAge.min || ageB >= prefAge.min) && (!prefAge.max || ageB <= prefAge.max)) matched++;
  }

  // Religion preference
  const prefReligions = profileA.content?.partnerPreferences?.religion;
  if (prefReligions && prefReligions.length > 0 && religionB) {
    total++;
    if (prefReligions.some((r) => r.toUpperCase() === religionB)) matched++;
  }

  // Diet preference
  const prefDiet = profileA.content?.partnerPreferences?.diet;
  if (prefDiet && prefDiet.length > 0 && dietB) {
    total++;
    if (prefDiet.some((d) => d.toUpperCase() === dietB.toUpperCase())) matched++;
  }

  // Education preference
  const prefEdu = profileA.content?.partnerPreferences?.education;
  if (prefEdu && prefEdu.length > 0 && profileB.content?.education?.degree) {
    total++;
    const bDegreeUpper = profileB.content.education.degree.toUpperCase();
    if (prefEdu.some((e) => bDegreeUpper.includes(e.toUpperCase()))) matched++;
  }

  // preference_match_pct = fraction of prefs NOT met (risk)
  let preference_match_pct: number;
  if (total === 0) {
    preference_match_pct = 0.3; // no preferences set → moderate risk
  } else {
    preference_match_pct = 1 - matched / total;
  }

  return {
    age_gap_years:          clamp(age_gap_years),
    education_gap:          clamp(education_gap),
    income_disparity_pct:   clamp(income_disparity_pct),
    family_values_alignment: clamp(family_values_alignment),
    lifestyle_compatibility: clamp(lifestyle_compatibility),
    communication_score:    clamp(communication_score),
    guna_milan_score:       clamp(guna_milan_score),
    geographic_distance_km: clamp(geographic_distance_km),
    religion_caste_match:   clamp(religion_caste_match),
    preference_match_pct:   clamp(preference_match_pct),
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
