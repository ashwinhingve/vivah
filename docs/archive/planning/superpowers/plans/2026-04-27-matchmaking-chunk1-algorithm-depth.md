# Matchmaking Chunk 1 — Algorithm Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade matchmaking core from 5-dim deterministic scorer to 6-dim with personality, distance-based filter, deal-breakers, MMR diversity, and a "why this match" explainer.

**Architecture:** Scorer becomes a registry of dimension functions for swappable weights (Chunk 2 prep). Filters gain a distance check (haversine) and per-pref `mustHave` flags. New explainer + diversity modules live alongside engine/scorer/filters. UI surfaces add a personality onboarding step, must-have toggles, distance slider, distance pill, and why-match panel.

**Tech Stack:** TypeScript, Drizzle (Postgres), Mongoose (Mongo), Express, Next.js 15 App Router, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-27-matchmaking-chunk1-algorithm-depth-design.md`

---

## Task 1: Extend shared profile types

**Files:**
- Modify: `packages/types/src/profile.ts`

- [ ] **Step 1: Add personality + mustHave + distance types**

Append to `packages/types/src/profile.ts`:

```ts
export type PersonalityAxis = number; // integer 1..7

export interface PersonalityProfile {
  introvertExtrovert: PersonalityAxis;
  traditionalModern: PersonalityAxis;
  plannerSpontaneous: PersonalityAxis;
  religiousSecular: PersonalityAxis;
  ambitiousBalanced: PersonalityAxis;
  familyIndependent: PersonalityAxis;
}

export type MustHaveKey =
  | 'age'
  | 'religion'
  | 'education'
  | 'income'
  | 'diet'
  | 'manglik'
  | 'caste'
  | 'distance';

export type MustHaveFlags = Partial<Record<MustHaveKey, boolean>>;

export interface PersonalityIdealAxis {
  value: PersonalityAxis;
  tolerance: number; // 1..3 — clipping window per axis
}

export type PersonalityIdeal = Partial<{
  introvertExtrovert: PersonalityIdealAxis;
  traditionalModern: PersonalityIdealAxis;
  plannerSpontaneous: PersonalityIdealAxis;
  religiousSecular: PersonalityIdealAxis;
  ambitiousBalanced: PersonalityIdealAxis;
  familyIndependent: PersonalityIdealAxis;
}>;
```

Then locate the existing `PartnerPreferences` (or equivalent) interface and add three optional fields:

```ts
maxDistanceKm?: number;          // default 100
mustHave?: MustHaveFlags;
personalityIdeal?: PersonalityIdeal;
```

Also locate the profile metadata interface (`ProfileMetaResponse` / similar) and add:

```ts
latitude?: number | null;
longitude?: number | null;
personality?: PersonalityProfile | null;
```

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @smartshaadi/types type-check
```

Expected: PASS (other packages may break — that's expected, fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/profile.ts
git commit -m "feat(types): add personality, mustHave, distance fields to profile"
```

---

## Task 2: Extend shared matching types

**Files:**
- Modify: `packages/types/src/matching.ts`

- [ ] **Step 1: Add explainer + distance + personalityFit dim**

Append:

```ts
export interface MatchExplainer {
  reasons: string[];        // length 0..3
  caveat: string | null;
}
```

In `CompatibilityBreakdown` add:

```ts
personalityFit: { score: number; max: number };
```

In `MatchFeedItem` add:

```ts
distanceKm: number | null;
explainer: MatchExplainer | null;
```

- [ ] **Step 2: Run type-check**

```bash
pnpm --filter @smartshaadi/types type-check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/matching.ts
git commit -m "feat(types): add MatchExplainer, distanceKm, personalityFit dim"
```

---

## Task 3: Extend Zod schemas for personality + mustHave

**Files:**
- Modify: `packages/schemas/src/profile.ts`

- [ ] **Step 1: Add new Zod schemas**

```ts
import { z } from 'zod';

export const PersonalityAxisSchema = z.number().int().min(1).max(7);

export const PersonalitySchema = z.object({
  introvertExtrovert: PersonalityAxisSchema,
  traditionalModern: PersonalityAxisSchema,
  plannerSpontaneous: PersonalityAxisSchema,
  religiousSecular: PersonalityAxisSchema,
  ambitiousBalanced: PersonalityAxisSchema,
  familyIndependent: PersonalityAxisSchema,
});

export const MustHaveFlagsSchema = z.object({
  age: z.boolean().optional(),
  religion: z.boolean().optional(),
  education: z.boolean().optional(),
  income: z.boolean().optional(),
  diet: z.boolean().optional(),
  manglik: z.boolean().optional(),
  caste: z.boolean().optional(),
  distance: z.boolean().optional(),
}).partial();

export const PersonalityIdealAxisSchema = z.object({
  value: PersonalityAxisSchema,
  tolerance: z.number().int().min(1).max(3),
});

export const PersonalityIdealSchema = z.object({
  introvertExtrovert: PersonalityIdealAxisSchema.optional(),
  traditionalModern: PersonalityIdealAxisSchema.optional(),
  plannerSpontaneous: PersonalityIdealAxisSchema.optional(),
  religiousSecular: PersonalityIdealAxisSchema.optional(),
  ambitiousBalanced: PersonalityIdealAxisSchema.optional(),
  familyIndependent: PersonalityIdealAxisSchema.optional(),
}).partial();
```

If a `PartnerPreferencesSchema` exists in this file, extend it with:

```ts
maxDistanceKm: z.number().int().min(5).max(2000).optional(),
mustHave: MustHaveFlagsSchema.optional(),
personalityIdeal: PersonalityIdealSchema.optional(),
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @smartshaadi/schemas type-check
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/schemas/src/profile.ts
git commit -m "feat(schemas): zod for personality, mustHave, personalityIdeal"
```

---

## Task 4: Add latitude/longitude to profiles table

**Files:**
- Modify: `packages/db/schema/index.ts` (or whichever file declares `profiles`)
- Create: `packages/db/migrations/0005_profile_lat_lng.sql`

- [ ] **Step 1: Add Drizzle columns**

Locate the `profiles` table declaration. Add after `lastActiveAt`:

```ts
latitude:  numeric('latitude', { precision: 9, scale: 6 }),
longitude: numeric('longitude', { precision: 9, scale: 6 }),
```

- [ ] **Step 2: Generate migration**

```bash
pnpm --filter @smartshaadi/db db:generate
```

This creates `0005_*.sql` automatically. Confirm the new file is created.

- [ ] **Step 3: Apply migration**

```bash
pnpm --filter @smartshaadi/db db:push
```

Expected: succeeds; columns added.

- [ ] **Step 4: Commit**

```bash
git add packages/db/schema/index.ts packages/db/migrations/
git commit -m "feat(db): add latitude/longitude to profiles"
```

---

## Task 5: Geocode helper

**Files:**
- Create: `apps/api/src/lib/geocode.ts`
- Create: `apps/api/src/lib/__tests__/geocode.test.ts`

- [ ] **Step 1: Write failing test**

`apps/api/src/lib/__tests__/geocode.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { geocode, _resetGeocodeCache } from '../geocode.js';

describe('geocode (mock mode)', () => {
  beforeEach(() => {
    process.env['USE_MOCK_SERVICES'] = 'true';
    _resetGeocodeCache();
  });

  it('returns deterministic coords for known city', async () => {
    const a = await geocode('Pune', 'Maharashtra');
    const b = await geocode('Pune', 'Maharashtra');
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a!.lat).toBeGreaterThan(18);
    expect(a!.lat).toBeLessThan(19);
  });

  it('falls back to state centroid for unknown city in known state', async () => {
    const r = await geocode('NonExistentCityX', 'Maharashtra');
    expect(r).not.toBeNull();
  });

  it('returns null for unknown state', async () => {
    const r = await geocode('Foo', 'Atlantis');
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
pnpm --filter @smartshaadi/api test -- geocode
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write geocode.ts**

```ts
import { env } from './env.js';

export interface Coords { lat: number; lng: number }

const CITY_TABLE: Record<string, Coords> = {
  mumbai:    { lat: 19.0760, lng: 72.8777 },
  delhi:     { lat: 28.7041, lng: 77.1025 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  pune:      { lat: 18.5204, lng: 73.8567 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai:   { lat: 13.0827, lng: 80.2707 },
  kolkata:   { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur:    { lat: 26.9124, lng: 75.7873 },
  lucknow:   { lat: 26.8467, lng: 80.9462 },
};

const STATE_CENTROIDS: Record<string, Coords> = {
  maharashtra:    { lat: 19.7515, lng: 75.7139 },
  karnataka:      { lat: 15.3173, lng: 75.7139 },
  delhi:          { lat: 28.7041, lng: 77.1025 },
  telangana:      { lat: 18.1124, lng: 79.0193 },
  tamilnadu:      { lat: 11.1271, lng: 78.6569 },
  westbengal:     { lat: 22.9868, lng: 87.8550 },
  gujarat:        { lat: 22.2587, lng: 71.1924 },
  rajasthan:      { lat: 27.0238, lng: 74.2179 },
  uttarpradesh:   { lat: 26.8467, lng: 80.9462 },
  punjab:         { lat: 31.1471, lng: 75.3412 },
  haryana:        { lat: 29.0588, lng: 76.0856 },
  kerala:         { lat: 10.8505, lng: 76.2711 },
  bihar:          { lat: 25.0961, lng: 85.3131 },
  madhyapradesh:  { lat: 22.9734, lng: 78.6569 },
  andhrapradesh:  { lat: 15.9129, lng: 79.7400 },
};

const NORM = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');
const cache = new Map<string, Coords | null>();
const MAX_CACHE = 1000;

export function _resetGeocodeCache(): void { cache.clear(); }

export async function geocode(
  city: string,
  state: string,
  _country: string = 'India',
): Promise<Coords | null> {
  const key = `${NORM(city)}|${NORM(state)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: Coords | null = null;
  const cityKey  = NORM(city);
  const stateKey = NORM(state);

  if (env.USE_MOCK_SERVICES) {
    result = CITY_TABLE[cityKey] ?? STATE_CENTROIDS[stateKey] ?? null;
  } else {
    try {
      const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=India&format=json&limit=1`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'smartshaadi/1.0' } });
      if (resp.ok) {
        const data = (await resp.json()) as Array<{ lat: string; lon: string }>;
        if (data[0]) result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {
      result = null;
    }
    if (!result) result = STATE_CENTROIDS[stateKey] ?? null;
  }

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, result);
  return result;
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
```

- [ ] **Step 4: Run test — confirm pass**

```bash
pnpm --filter @smartshaadi/api test -- geocode
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/geocode.ts apps/api/src/lib/__tests__/geocode.test.ts
git commit -m "feat(api): geocode helper with mock-mode IN city seed table"
```

---

## Task 6: Personality scorer module

**Files:**
- Create: `apps/api/src/matchmaking/personality.ts`
- Create: `apps/api/src/matchmaking/__tests__/personality.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { scorePersonality, AXIS_KEYS } from '../personality.js';
import type { PersonalityProfile } from '@smartshaadi/types';

const same: PersonalityProfile = {
  introvertExtrovert: 4, traditionalModern: 4, plannerSpontaneous: 4,
  religiousSecular: 4, ambitiousBalanced: 4, familyIndependent: 4,
};
const opposite: PersonalityProfile = {
  introvertExtrovert: 7, traditionalModern: 7, plannerSpontaneous: 7,
  religiousSecular: 7, ambitiousBalanced: 7, familyIndependent: 7,
};

describe('scorePersonality', () => {
  it('returns 15 for identical profiles', () => {
    expect(scorePersonality(same, same).score).toBe(15);
    expect(scorePersonality(same, same).flag).toBeNull();
  });

  it('returns ~0 for max-distance opposite profiles', () => {
    const r = scorePersonality({ ...same, introvertExtrovert: 1, traditionalModern: 1, plannerSpontaneous: 1, religiousSecular: 1, ambitiousBalanced: 1, familyIndependent: 1 }, opposite);
    expect(r.score).toBe(0);
  });

  it('returns 7 + flag when one side missing', () => {
    const r = scorePersonality(null, same);
    expect(r.score).toBe(7);
    expect(r.flag).toBe('personality_pending');
  });

  it('respects per-axis tolerance clipping', () => {
    const userIdeal = {
      introvertExtrovert: { value: 4, tolerance: 1 },
    };
    const candidate: PersonalityProfile = { ...same, introvertExtrovert: 7 };
    const r = scorePersonality(same, candidate, userIdeal);
    // delta clipped to 1 instead of 3, expect score nearer to 15
    expect(r.score).toBeGreaterThan(scorePersonality(same, candidate).score);
  });

  it('exports 6 axis keys', () => {
    expect(AXIS_KEYS).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm --filter @smartshaadi/api test -- personality
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write personality.ts**

```ts
import type { PersonalityProfile, PersonalityIdeal } from '@smartshaadi/types';

export const AXIS_KEYS = [
  'introvertExtrovert',
  'traditionalModern',
  'plannerSpontaneous',
  'religiousSecular',
  'ambitiousBalanced',
  'familyIndependent',
] as const;

export type AxisKey = typeof AXIS_KEYS[number];

const MAX_AXIS_DELTA = 6; // (7 - 1)
const MAX_TOTAL_DISTANCE = Math.sqrt(AXIS_KEYS.length * MAX_AXIS_DELTA * MAX_AXIS_DELTA);
const WEIGHT = 15;

export interface PersonalityScoreResult {
  score: number;
  flag: 'personality_pending' | null;
}

export function scorePersonality(
  user: PersonalityProfile | null | undefined,
  candidate: PersonalityProfile | null | undefined,
  userIdeal?: PersonalityIdeal,
): PersonalityScoreResult {
  if (!user || !candidate) {
    return { score: 7, flag: 'personality_pending' };
  }
  let sumSquares = 0;
  for (const axis of AXIS_KEYS) {
    const u = user[axis];
    const c = candidate[axis];
    if (typeof u !== 'number' || typeof c !== 'number') {
      return { score: 7, flag: 'personality_pending' };
    }
    const tolerance = userIdeal?.[axis]?.tolerance ?? MAX_AXIS_DELTA;
    const delta = Math.min(Math.abs(u - c), tolerance);
    sumSquares += delta * delta;
  }
  const dist = Math.sqrt(sumSquares);
  const normalized = dist / MAX_TOTAL_DISTANCE;
  const score = Math.max(0, Math.min(WEIGHT, Math.round(WEIGHT * (1 - normalized))));
  return { score, flag: null };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm --filter @smartshaadi/api test -- personality
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/matchmaking/personality.ts apps/api/src/matchmaking/__tests__/personality.test.ts
git commit -m "feat(matchmaking): personality dim scorer (6-axis Euclidean)"
```

---

## Task 7: Refactor scorer to registry pattern + integrate personality

**Files:**
- Modify: `apps/api/src/matchmaking/scorer.ts`

- [ ] **Step 1: Update ProfileData interface**

Inside `scorer.ts`, extend the existing `ProfileData` interface:

```ts
personality?: import('@smartshaadi/types').PersonalityProfile | null
latitude?: number | null
longitude?: number | null
```

In the `preferences` block of `ProfileData`, add:

```ts
maxDistanceKm?: number
mustHave?: import('@smartshaadi/types').MustHaveFlags
personalityIdeal?: import('@smartshaadi/types').PersonalityIdeal
```

- [ ] **Step 2: Add registry + personalityFit**

Add at the top of the dimension functions block (above `scoreDemographicAlignment`):

```ts
import { scorePersonality } from './personality.js';
```

Replace the body of `scoreDemographicAlignment` to cap at **20** instead of 25:

```ts
return Math.min(score, 20);
```

Replace `scoreLifestyleCompatibility` cap at **15**:

```ts
return Math.min(score, 15);
```

Replace `scoreFamilyValues` cap at **15**:

```ts
return Math.min(score, 15);
```

(`scoreCareerEducation` and `scorePreferenceOverlap` keep their caps of 15 and 20.)

- [ ] **Step 3: Update CompatibilityBreakdown construction**

Replace the existing breakdown computation block in `scoreCandidate` with:

```ts
  const demographicScore = scoreDemographicAlignment(userProfile, candidateProfile);
  const lifestyleScore   = scoreLifestyleCompatibility(userProfile, candidateProfile);
  const careerScore      = scoreCareerEducation(userProfile, candidateProfile);
  const familyScore      = scoreFamilyValues(userProfile, candidateProfile);
  const preferenceScore  = scorePreferenceOverlap(userProfile, candidateProfile);
  const personalityResult = scorePersonality(
    userProfile.personality ?? null,
    candidateProfile.personality ?? null,
    userProfile.preferences.personalityIdeal,
  );
  if (personalityResult.flag) flags.push(personalityResult.flag);

  // Guna score from Redis (unchanged)
  const [idA, idB] = [userProfile.id, candidateProfile.id].sort();
  const redisKey   = `match_scores:${idA}:${idB}`;
  const raw        = await redis.get(redisKey);

  let gunaScore: number;
  if (raw === null) {
    gunaScore = 18;
    flags.push('guna_pending');
  } else {
    const parsed = Number(raw);
    gunaScore = Number.isNaN(parsed) ? 18 : Math.max(0, Math.min(36, parsed));
    if (Number.isNaN(parsed)) flags.push('guna_parse_error');
  }
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
```

The tier calculation (`excellent`/`good`/etc.) stays unchanged.

- [ ] **Step 4: Run tests + type-check**

```bash
pnpm --filter @smartshaadi/api type-check
pnpm --filter @smartshaadi/api test -- scorer
```

The existing `scorer` test file may need its expected `max` numbers updated (25→20, 20→15 on familyValues and lifestyle). Update the expected breakdown maxes inline so tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/matchmaking/scorer.ts apps/api/src/matchmaking/__tests__/
git commit -m "refactor(matchmaking): 6-dim scorer with personality, weights resum"
```

---

## Task 8: Distance filter + mustHave promotions

**Files:**
- Modify: `apps/api/src/matchmaking/filters.ts`
- Modify: `apps/api/src/matchmaking/__tests__/filters.test.ts` (or create if absent)

- [ ] **Step 1: Extend ProfileWithPreferences**

In `filters.ts`, add to the interface:

```ts
latitude?: number | null
longitude?: number | null
preferences: {
  // ... existing fields ...
  maxDistanceKm?: number
  mustHave?: import('@smartshaadi/types').MustHaveFlags
  education?: string[]
  diet?: string[]
}
```

Also import the haversine helper:

```ts
import { haversineKm } from '../lib/geocode.js';
```

- [ ] **Step 2: Replace passesLocationFilter with passesDistanceFilter**

Delete the existing `passesLocationFilter` body. Add:

```ts
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
  return (uCity && uCity === cCity) || (uState && uState === cState) ? true : false;
}
```

Wire it into `passesAllFilters` (replace `passesLocationFilter` reference).

- [ ] **Step 3: Add education + diet hard filters (mustHave-gated)**

```ts
function passesEducationFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userMust      = user.preferences.mustHave?.education      === true;
  const candidateMust = candidate.preferences.mustHave?.education === true;
  if (!userMust && !candidateMust) return true;

  if (userMust && Array.isArray(user.preferences.education) && user.preferences.education.length > 0) {
    if (!user.preferences.education.includes((candidate as unknown as { education?: string }).education ?? '')) return false;
  }
  if (candidateMust && Array.isArray(candidate.preferences.education) && candidate.preferences.education.length > 0) {
    if (!candidate.preferences.education.includes((user as unknown as { education?: string }).education ?? '')) return false;
  }
  return true;
}

function passesDietFilter(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  const userMust      = user.preferences.mustHave?.diet      === true;
  const candidateMust = candidate.preferences.mustHave?.diet === true;
  if (!userMust && !candidateMust) return true;

  if (userMust && Array.isArray(user.preferences.diet) && user.preferences.diet.length > 0) {
    if (!user.preferences.diet.includes((candidate as unknown as { diet?: string }).diet ?? '')) return false;
  }
  if (candidateMust && Array.isArray(candidate.preferences.diet) && candidate.preferences.diet.length > 0) {
    if (!candidate.preferences.diet.includes((user as unknown as { diet?: string }).diet ?? '')) return false;
  }
  return true;
}
```

To make these compile cleanly, also add `education?: string` and `diet?: string` to `ProfileWithPreferences` (top-level — these mirror what the engine already attaches).

- [ ] **Step 4: Promote religion + caste mustHave**

In `passesReligionFilter`, replace:

```ts
if (user.preferences.openToInterfaith || candidate.preferences.openToInterfaith) {
  return true;
}
```

with:

```ts
const mustHave = user.preferences.mustHave?.religion === true || candidate.preferences.mustHave?.religion === true;
if (!mustHave && (user.preferences.openToInterfaith || candidate.preferences.openToInterfaith)) {
  return true;
}
```

In `passesCasteFilter`, replace:

```ts
if (user.preferences.openToInterCaste || candidate.preferences.openToInterCaste) return true;
```

with:

```ts
const mustHave = user.preferences.mustHave?.caste === true || candidate.preferences.mustHave?.caste === true;
if (!mustHave && (user.preferences.openToInterCaste || candidate.preferences.openToInterCaste)) return true;
```

In `passesManglikFilter`, replace `if (!pref || pref === 'ANY') return true;` with:

```ts
const mustHave = user.preferences.mustHave?.manglik === true;
const effective = pref ?? (mustHave ? 'NON_MANGLIK' : 'ANY');
if (effective === 'ANY') return true;
```

Then use `effective` (not `pref`) in the rest of the body.

- [ ] **Step 5: Wire all into passesAllFilters**

```ts
function passesAllFilters(
  user: ProfileWithPreferences,
  candidate: ProfileWithPreferences,
): boolean {
  return (
    passesAgeFilter(user, candidate) &&
    passesReligionFilter(user, candidate) &&
    passesDistanceFilter(user, candidate) &&
    passesIncomeFilter(user, candidate) &&
    passesEducationFilter(user, candidate) &&
    passesDietFilter(user, candidate) &&
    passesCasteFilter(user, candidate) &&
    passesGotraFilter(user, candidate) &&
    passesManglikFilter(user, candidate)
  );
}
```

- [ ] **Step 6: Add tests**

In `apps/api/src/matchmaking/__tests__/filters.test.ts` add:

```ts
import { describe, it, expect } from 'vitest';
import { applyHardFilters, type ProfileWithPreferences } from '../filters.js';

const base: ProfileWithPreferences = {
  id: 'a', age: 28, religion: 'Hindu', city: 'Pune', state: 'Maharashtra',
  incomeMin: 50000, incomeMax: 100000,
  latitude: 18.5204, longitude: 73.8567,
  preferences: {
    ageMin: 22, ageMax: 35, religion: ['Hindu'], openToInterfaith: false,
    city: 'Pune', state: 'Maharashtra',
    incomeMin: 30000, incomeMax: 200000, maxDistanceKm: 100,
  },
};

describe('distance filter', () => {
  it('passes when both within radius', () => {
    const cand = { ...base, id: 'b', latitude: 18.6, longitude: 73.9 };
    expect(applyHardFilters(base, [cand])).toHaveLength(1);
  });

  it('fails when beyond limit', () => {
    const cand = { ...base, id: 'b', latitude: 28.7, longitude: 77.1 }; // Delhi
    expect(applyHardFilters(base, [cand])).toHaveLength(0);
  });

  it('falls back to state match when coords missing', () => {
    const cand = { ...base, id: 'b', latitude: undefined, longitude: undefined };
    expect(applyHardFilters({ ...base, latitude: undefined, longitude: undefined }, [cand])).toHaveLength(1);
  });

  it('mustHave.distance disables fallback', () => {
    const u = { ...base, latitude: undefined, longitude: undefined,
      preferences: { ...base.preferences, mustHave: { distance: true } } };
    const cand = { ...base, id: 'b', latitude: undefined, longitude: undefined };
    expect(applyHardFilters(u, [cand])).toHaveLength(0);
  });
});

describe('mustHave education', () => {
  it('promotes soft to hard when set', () => {
    const u = { ...base,
      education: 'masters',
      preferences: { ...base.preferences, education: ['masters'], mustHave: { education: true } },
    };
    const candPass = { ...base, id: 'b', education: 'masters' };
    const candFail = { ...base, id: 'c', education: '12th' };
    expect(applyHardFilters(u, [candPass, candFail])).toHaveLength(1);
  });
});

describe('mustHave religion bypasses interfaith', () => {
  it('rejects interfaith even when openToInterfaith=true', () => {
    const u = { ...base,
      preferences: { ...base.preferences, openToInterfaith: true, mustHave: { religion: true } },
    };
    const cand = { ...base, id: 'b', religion: 'Christian' };
    expect(applyHardFilters(u, [cand])).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @smartshaadi/api test -- filters
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/matchmaking/filters.ts apps/api/src/matchmaking/__tests__/filters.test.ts
git commit -m "feat(matchmaking): distance + mustHave hard-filter promotions"
```

---

## Task 9: Explainer module

**Files:**
- Create: `apps/api/src/matchmaking/explainer.ts`
- Create: `apps/api/src/matchmaking/__tests__/explainer.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { explainMatch } from '../explainer.js';
import type { CompatibilityScore } from '@smartshaadi/types';
import type { ProfileData } from '../scorer.js';

const u: ProfileData = {
  id: 'u', age: 28, religion: 'Hindu', city: 'Pune', state: 'Maharashtra',
  incomeMin: 50000, incomeMax: 100000, education: 'masters',
  occupation: 'software_engineer', familyType: 'NUCLEAR', familyValues: 'MODERATE',
  diet: 'VEG', smoke: false, drink: false,
  preferences: { ageMin: 22, ageMax: 35, religion: ['Hindu'], openToInterfaith: false,
    education: [], incomeMin: 0, incomeMax: 999999, familyType: [], diet: [] },
};
const c: ProfileData = { ...u, id: 'c', age: 27 };

const goodScore: CompatibilityScore = {
  totalScore: 90,
  tier: 'excellent',
  flags: [],
  gunaScore: 30,
  breakdown: {
    demographicAlignment:   { score: 18, max: 20 },
    lifestyleCompatibility: { score: 15, max: 15 },
    careerEducation:        { score: 12, max: 15 },
    familyValues:           { score: 12, max: 15 },
    preferenceOverlap:      { score: 18, max: 20 },
    personalityFit:         { score: 13, max: 15 },
  },
};

describe('explainMatch', () => {
  it('returns top-3 reasons when many dims fill > 70%', () => {
    const r = explainMatch(u, c, goodScore, 12);
    expect(r.reasons).toHaveLength(3);
    expect(r.caveat).toBeNull();
  });

  it('emits caveat when a dim < 40%', () => {
    const weak = { ...goodScore,
      breakdown: { ...goodScore.breakdown,
        familyValues: { score: 4, max: 15 } } };
    const r = explainMatch(u, c, weak, 12);
    expect(r.caveat).toBeTruthy();
  });

  it('city + distance phrase when sameCity and distance present', () => {
    const r = explainMatch(u, c, goodScore, 8);
    expect(r.reasons.some(x => /Pune/.test(x))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm --filter @smartshaadi/api test -- explainer
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write explainer.ts**

```ts
import type { CompatibilityScore, MatchExplainer, CompatibilityBreakdown } from '@smartshaadi/types';
import type { ProfileData } from './scorer.js';

type DimKey = keyof CompatibilityBreakdown;

const VEG_SET = new Set(['VEG', 'JAIN', 'VEGAN', 'EGGETARIAN']);
const OCC_CAT: Record<string, string> = {
  software_engineer: 'tech', developer: 'tech', data_scientist: 'tech', it_professional: 'tech',
  doctor: 'healthcare', nurse: 'healthcare', pharmacist: 'healthcare',
  teacher: 'education', professor: 'education',
  lawyer: 'legal', advocate: 'legal',
  engineer: 'engineering', architect: 'engineering',
  businessman: 'business', entrepreneur: 'business',
  banker: 'finance', accountant: 'finance',
  government: 'government', civil_servant: 'government',
};
const occCat = (s: string): string => OCC_CAT[(s ?? '').toLowerCase()] ?? 'other';

function reasonFor(dim: DimKey, u: ProfileData, c: ProfileData, distanceKm: number | null): string {
  switch (dim) {
    case 'demographicAlignment': {
      const sameCity = u.city.toLowerCase() === c.city.toLowerCase() && u.city.length > 0;
      if (sameCity) {
        return distanceKm !== null && distanceKm > 0 ? `Both in ${u.city}, ${distanceKm}km apart` : `Both in ${u.city}`;
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
      if (u.familyType === c.familyType) return `Same family setup (${u.familyType.toLowerCase()})`;
      return 'Aligned family values';
    case 'preferenceOverlap':
      return 'Strong preference match';
    case 'personalityFit':
      return 'Compatible personalities';
  }
}

function caveatFor(dim: DimKey): string {
  switch (dim) {
    case 'demographicAlignment':   return 'Different cities or ages';
    case 'lifestyleCompatibility': return 'Different lifestyles';
    case 'careerEducation':        return 'Different fields/education';
    case 'familyValues':           return 'Different family setups';
    case 'preferenceOverlap':      return 'Limited preference overlap';
    case 'personalityFit':         return 'Different personalities';
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
    .map((d) => ({ d, ratio: score.breakdown[d].score / Math.max(1, score.breakdown[d].max) }))
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
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm --filter @smartshaadi/api test -- explainer
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/matchmaking/explainer.ts apps/api/src/matchmaking/__tests__/explainer.test.ts
git commit -m "feat(matchmaking): deterministic match explainer (top-3 + caveat)"
```

---

## Task 10: MMR diversity reranker

**Files:**
- Create: `apps/api/src/matchmaking/diversity.ts`
- Create: `apps/api/src/matchmaking/__tests__/diversity.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mmrRerank, type ClusterableItem } from '../diversity.js';

function mk(id: string, score: number, cluster: string[]): ClusterableItem {
  return {
    profileId: id,
    compatibility: { totalScore: score, tier: 'good', flags: [], gunaScore: 18,
      breakdown: {} as never },
    _clusterKeys: cluster,
  };
}

describe('mmrRerank', () => {
  it('λ=1 keeps pure score order', () => {
    const items = [mk('a', 90, ['x']), mk('b', 80, ['x']), mk('c', 70, ['y'])];
    const out = mmrRerank(items, 1.0);
    expect(out.map(i => i.profileId)).toEqual(['a', 'b', 'c']);
  });

  it('λ=0.7 prefers diversity when scores close', () => {
    const items = [mk('a', 90, ['x']), mk('b', 88, ['x']), mk('c', 85, ['y'])];
    const out = mmrRerank(items, 0.7);
    expect(out[0]!.profileId).toBe('a');   // top score wins
    expect(out[1]!.profileId).toBe('c');   // diversity beats near-score b
  });

  it('λ=0 ignores score, maximizes diversity', () => {
    const items = [mk('a', 90, ['x']), mk('b', 50, ['y']), mk('c', 80, ['x'])];
    const out = mmrRerank(items, 0.0);
    expect(out[1]!.profileId).toBe('b');   // most different from a
  });

  it('respects k cap', () => {
    const items = Array.from({ length: 10 }, (_, i) => mk(`p${i}`, 90 - i, ['x']));
    expect(mmrRerank(items, 0.7, 3)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm --filter @smartshaadi/api test -- diversity
```

Expected: FAIL.

- [ ] **Step 3: Write diversity.ts**

```ts
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
  const sorted = [...items].sort((a, b) => b.compatibility.totalScore - a.compatibility.totalScore);
  const picked: T[] = [];
  const remaining = sorted.slice();
  // Always start with the highest-scoring item
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
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
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
  if (opts.caste)              keys.push(`caste:${opts.caste.toLowerCase()}`);
  if (opts.occupationCategory) keys.push(`occ:${opts.occupationCategory.toLowerCase()}`);
  if (opts.city)               keys.push(`city:${opts.city.toLowerCase()}`);
  if (typeof opts.age === 'number' && opts.age > 0) {
    keys.push(`age:${Math.floor(opts.age / 5)}`);
  }
  return keys;
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm --filter @smartshaadi/api test -- diversity
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/matchmaking/diversity.ts apps/api/src/matchmaking/__tests__/diversity.test.ts
git commit -m "feat(matchmaking): MMR diversity reranker over cluster keys"
```

---

## Task 11: Engine integration — distance, MMR, explainer

**Files:**
- Modify: `apps/api/src/matchmaking/engine.ts`

- [ ] **Step 1: Update ProfileRow to carry coords**

In `engine.ts`, add to `ProfileRow`:

```ts
latitude?:  number | string | null
longitude?: number | string | null
```

- [ ] **Step 2: Plumb coords + personality through rowToProfileData**

In `rowToProfileData`, return:

```ts
const lat = row.latitude  != null ? Number(row.latitude)  : null;
const lng = row.longitude != null ? Number(row.longitude) : null;

return {
  // ... existing fields ...
  latitude:  lat,
  longitude: lng,
  personality: (row as unknown as { personality?: import('@smartshaadi/types').PersonalityProfile }).personality ?? null,
  preferences: {
    // ... existing fields ...
    maxDistanceKm: row.partnerPreferences?.maxDistanceKm ?? 100,
    mustHave:      (row.partnerPreferences as unknown as { mustHave?: import('@smartshaadi/types').MustHaveFlags }).mustHave ?? {},
    personalityIdeal: (row.partnerPreferences as unknown as { personalityIdeal?: import('@smartshaadi/types').PersonalityIdeal }).personalityIdeal ?? {},
  },
};
```

Add to `ProfileRow.partnerPreferences` typing:

```ts
maxDistanceKm?:    number | null
```

Add to `ContentDoc`:

```ts
personality?: import('@smartshaadi/types').PersonalityProfile | null
```

In `enrichRow`, mirror personality:

```ts
const personality = doc.personality ?? (row as unknown as { personality?: ContentDoc['personality'] }).personality;
if (personality !== undefined) (enriched as unknown as { personality?: ContentDoc['personality'] }).personality = personality;
```

- [ ] **Step 3: Update toFilterProfile for coords + mustHave + education + diet**

```ts
function toFilterProfile(p: ProfileData): ProfileWithPreferences {
  return {
    id:         p.id,
    age:        p.age,
    religion:   p.religion,
    city:       p.city,
    state:      p.state,
    incomeMin:  p.incomeMin,
    incomeMax:  p.incomeMax,
    latitude:   p.latitude ?? null,
    longitude:  p.longitude ?? null,
    education:  p.education,
    diet:       p.diet,
    manglik:    p.manglik ?? null,
    caste:      p.caste ?? null,
    gotra:      p.gotra ?? null,
    gotraExclusionEnabled: p.gotraExclusionEnabled ?? true,
    preferences: {
      ageMin:           p.preferences.ageMin,
      ageMax:           p.preferences.ageMax,
      religion:         p.preferences.religion,
      openToInterfaith: p.preferences.openToInterfaith,
      city:             p.city,
      state:            p.state,
      incomeMin:        p.preferences.incomeMin,
      incomeMax:        p.preferences.incomeMax,
      maxDistanceKm:    p.preferences.maxDistanceKm,
      mustHave:         p.preferences.mustHave,
      education:        p.preferences.education,
      diet:             p.preferences.diet,
      ...(p.preferences.manglik ? { manglik: p.preferences.manglik } : {}),
      ...(p.preferences.openToInterCaste !== undefined ? { openToInterCaste: p.preferences.openToInterCaste } : {}),
    },
  };
}
```

- [ ] **Step 4: Compute distanceKm + explainer + MMR inside scoreAndRank/computeAndCacheFeed**

Add imports at top:

```ts
import { explainMatch } from './explainer.js';
import { mmrRerank, buildClusterKeys, type ClusterableItem } from './diversity.js';
import { haversineKm } from '../lib/geocode.js';
```

In `scoreAndRank`, replace the `feedItem` construction with:

```ts
const distanceKm: number | null =
  typeof userProfile.latitude === 'number' && typeof userProfile.longitude === 'number' &&
  typeof candidate.latitude  === 'number' && typeof candidate.longitude  === 'number'
    ? haversineKm(
        { lat: userProfile.latitude, lng: userProfile.longitude },
        { lat: candidate.latitude,  lng: candidate.longitude },
      )
    : null;

const explainer = explainMatch(userProfile, candidate, compatibility, distanceKm);

const feedItem: MatchFeedItem = {
  profileId:    candidate.id,
  name:         '',
  age:          candidate.age,
  city:         candidate.city,
  compatibility,
  photoKey:     photoMap.get(candidate.id) ?? null,
  isNew,
  isVerified:   true,
  photoHidden:  photoMap.get(candidate.id) === null,
  shortlisted:  false,
  manglik:      candidate.manglik ?? null,
  lastActiveAt: candidate.lastActiveAt ?? null,
  premiumTier:  candidate.premiumTier ?? 'FREE',
  distanceKm,
  explainer,
};
```

In `computeAndCacheFeed`, before `await redis.setex(...)` at the end, insert MMR rerank:

```ts
// MMR diversity rerank (λ=0.7) over caste/occupation/city/age cluster keys
const enrichedForMmr: Array<MatchFeedItem & ClusterableItem> = feed.map((item) => {
  const candProfile = candidateProfiles.find((p) => p.id === item.profileId);
  const cluster = buildClusterKeys({
    caste:              candProfile?.caste ?? null,
    occupationCategory: candProfile?.occupation ?? null,
    city:               candProfile?.city ?? null,
    age:                candProfile?.age ?? null,
  });
  return Object.assign(item, { _clusterKeys: cluster });
});
const reranked = mmrRerank(enrichedForMmr, 0.7, 50)
  .map(({ _clusterKeys, ...rest }) => rest as MatchFeedItem);
await redis.setex(feedKey(userId), FEED_CACHE_TTL, JSON.stringify(reranked));

return reranked;
```

(Delete the old `await redis.setex(...); return feed;` lines.)

- [ ] **Step 5: Run engine tests + smoke type-check**

```bash
pnpm --filter @smartshaadi/api type-check
pnpm --filter @smartshaadi/api test -- engine
```

Existing engine tests may need updates to cover `distanceKm`/`explainer` shape. Update inline.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/matchmaking/engine.ts apps/api/src/matchmaking/__tests__/engine.test.ts
git commit -m "feat(matchmaking): wire distance + explainer + MMR into engine"
```

---

## Task 12: API surface — POST /me/personality + explainer in /score

**Files:**
- Modify: `apps/api/src/profiles/router.ts`
- Modify: `apps/api/src/profiles/service.ts`
- Modify: `apps/api/src/matchmaking/router.ts`

- [ ] **Step 1: Add POST /me/personality endpoint**

In `apps/api/src/profiles/router.ts`, near other `/me/*` routes (BEFORE the `/:id` wildcard) add:

```ts
import { PersonalitySchema } from '@smartshaadi/schemas';
import { savePersonality, resolveSelfProfileId } from './service.js';

profileRouter.post(
  '/me/personality',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PersonalitySchema.safeParse(req.body);
    if (!parsed.success) {
      err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid personality', 400);
      return;
    }
    try {
      await savePersonality(req.user!.id, parsed.data);
      ok(res, { saved: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save personality';
      err(res, 'PERSONALITY_SAVE_ERROR', message, 500);
    }
  },
);
```

- [ ] **Step 2: Add savePersonality to profile service**

In `apps/api/src/profiles/service.ts` add:

```ts
import type { PersonalityProfile } from '@smartshaadi/types';
import { mockUpsertField } from '../lib/mockStore.js';
import { env } from '../lib/env.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';

export async function savePersonality(
  userId: string,
  personality: PersonalityProfile,
): Promise<void> {
  if (env.USE_MOCK_SERVICES) {
    mockUpsertField(userId, 'personality', personality);
    return;
  }
  await ProfileContent.updateOne(
    { userId },
    { $set: { personality } },
    { upsert: true },
  );
}
```

- [ ] **Step 3: Geocode on location save**

Locate the existing location-save function in `service.ts` (search for one that writes `location.city` / `location.state`). After the section is upserted, add:

```ts
import { geocode } from '../lib/geocode.js';
import { db } from '../lib/db.js';
import { profiles } from '@smartshaadi/db';
import { eq } from 'drizzle-orm';

// inside the location-save function, AFTER mongo upsert:
const coords = await geocode(payload.city ?? '', payload.state ?? '');
if (coords) {
  await db.update(profiles).set({
    latitude:  String(coords.lat),
    longitude: String(coords.lng),
  }).where(eq(profiles.userId, userId));
}
```

(Adjust to whatever the local function's variable names are — the engineer should follow existing patterns in this file.)

- [ ] **Step 4: Add explainer to /score response**

In `apps/api/src/matchmaking/router.ts`, in the GET `/score/:profileId` handler, replace the `ok(res, score);` line with:

```ts
import { explainMatch } from './explainer.js';
import { haversineKm } from '../lib/geocode.js';

// ... inside handler, after computing score ...
const distanceKm =
  typeof userProfile.latitude === 'number' && typeof userProfile.longitude === 'number' &&
  typeof candidateProfile.latitude === 'number' && typeof candidateProfile.longitude === 'number'
    ? haversineKm(
        { lat: userProfile.latitude, lng: userProfile.longitude },
        { lat: candidateProfile.latitude, lng: candidateProfile.longitude },
      )
    : null;
const explainer = explainMatch(userProfile, candidateProfile, score, distanceKm);
ok(res, { ...score, explainer, distanceKm });
```

- [ ] **Step 5: Type-check + smoke**

```bash
pnpm --filter @smartshaadi/api type-check
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/profiles/ apps/api/src/matchmaking/router.ts
git commit -m "feat(api): POST /me/personality, geocode-on-save, explainer in /score"
```

---

## Task 13: Onboarding — personality step

**Files:**
- Create: `apps/web/src/app/(onboarding)/profile/personality/page.tsx`
- Modify: `apps/web/src/app/(onboarding)/profile/actions.ts`

- [ ] **Step 1: Add server action**

In `actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import type { PersonalityProfile } from '@smartshaadi/types';

export async function savePersonalityAction(p: PersonalityProfile): Promise<{ ok: boolean; error?: string }> {
  const session = (await cookies()).get(process.env.SESSION_COOKIE_NAME ?? 'shaadi.session')?.value;
  if (!session) return { ok: false, error: 'Not authenticated' };

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const resp = await fetch(`${apiBase}/api/v1/profiles/me/personality`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: `${process.env.SESSION_COOKIE_NAME ?? 'shaadi.session'}=${session}` },
    body: JSON.stringify(p),
  });
  if (!resp.ok) {
    const data = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, error: data.error?.message ?? 'Save failed' };
  }
  return { ok: true };
}
```

- [ ] **Step 2: Personality page**

Create `apps/web/src/app/(onboarding)/profile/personality/page.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePersonalityAction } from '../actions';

const AXES: Array<{ key: keyof PersonalityState; label: string; left: string; right: string }> = [
  { key: 'introvertExtrovert', label: 'Social energy',     left: 'Introvert',  right: 'Extrovert' },
  { key: 'traditionalModern',  label: 'Outlook',           left: 'Traditional', right: 'Modern' },
  { key: 'plannerSpontaneous', label: 'Decision style',    left: 'Planner',     right: 'Spontaneous' },
  { key: 'religiousSecular',   label: 'Religiousness',     left: 'Religious',   right: 'Secular' },
  { key: 'ambitiousBalanced',  label: 'Career drive',      left: 'Ambitious',   right: 'Balanced' },
  { key: 'familyIndependent',  label: 'Family closeness',  left: 'Family-first', right: 'Independent' },
];

interface PersonalityState {
  introvertExtrovert: number; traditionalModern: number; plannerSpontaneous: number;
  religiousSecular: number; ambitiousBalanced: number; familyIndependent: number;
}

const DEFAULTS: PersonalityState = {
  introvertExtrovert: 4, traditionalModern: 4, plannerSpontaneous: 4,
  religiousSecular: 4, ambitiousBalanced: 4, familyIndependent: 4,
};

export default function PersonalityPage(): JSX.Element {
  const router = useRouter();
  const [vals, setVals] = useState<PersonalityState>(DEFAULTS);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md p-5 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#0A1F4D]">Tell us about yourself</h1>
        <p className="text-sm text-slate-500">Six quick sliders. Helps us find people who fit you.</p>
      </header>

      {AXES.map((axis) => (
        <div key={axis.key} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-700">{axis.label}</span>
            <span className="text-xs text-slate-400">{vals[axis.key]}/7</span>
          </div>
          <input
            type="range" min={1} max={7} step={1}
            value={vals[axis.key]}
            onChange={(e) => setVals((v) => ({ ...v, [axis.key]: Number(e.target.value) }))}
            className="w-full accent-[#1848C8]"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{axis.left}</span><span>{axis.right}</span>
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const r = await savePersonalityAction(vals);
          if (!r.ok) { setError(r.error ?? 'Save failed'); return; }
          router.push('/profile/preferences');
        })}
        className="w-full rounded-lg bg-[#1848C8] py-3 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Continue'}
      </button>

      <button
        type="button"
        onClick={() => router.push('/profile/preferences')}
        className="w-full text-sm text-slate-500 underline"
      >
        Skip for now
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Smoke render**

```bash
pnpm --filter @smartshaadi/web type-check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(onboarding\)/profile/personality/ apps/web/src/app/\(onboarding\)/profile/actions.ts
git commit -m "feat(web): personality onboarding step (6 sliders)"
```

---

## Task 14: DistancePill + WhyMatchPanel components

**Files:**
- Create: `apps/web/src/components/profile/DistancePill.tsx`
- Create: `apps/web/src/components/profile/WhyMatchPanel.tsx`

- [ ] **Step 1: DistancePill**

```tsx
interface Props {
  distanceKm: number | null;
  fallbackCity: string | null;
}

export function DistancePill({ distanceKm, fallbackCity }: Props): JSX.Element | null {
  if (distanceKm !== null && distanceKm < 50) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
        {distanceKm}km away
      </span>
    );
  }
  if (fallbackCity) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
        {fallbackCity}
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 2: WhyMatchPanel**

```tsx
import type { MatchExplainer } from '@smartshaadi/types';
import { UpgradeCTA } from '../ui/UpgradeCTA';

interface Props {
  explainer: MatchExplainer | null;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
}

export function WhyMatchPanel({ explainer, tier }: Props): JSX.Element | null {
  if (!explainer || (explainer.reasons.length === 0 && !explainer.caveat)) return null;

  const locked = tier === 'FREE';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-[#0A1F4D]">Why you match</h3>
      <div className={locked ? 'pointer-events-none select-none blur-sm' : ''}>
        <ul className="space-y-1.5">
          {explainer.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {r}
            </li>
          ))}
          {explainer.caveat && (
            <li className="flex items-start gap-2 text-sm text-amber-700">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              {explainer.caveat}
            </li>
          )}
        </ul>
      </div>
      {locked && (
        <div className="mt-3">
          <UpgradeCTA reason="See why you match — upgrade to Standard" requiredTier="STANDARD" />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @smartshaadi/web type-check
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/profile/DistancePill.tsx apps/web/src/components/profile/WhyMatchPanel.tsx
git commit -m "feat(web): DistancePill + WhyMatchPanel components"
```

---

## Task 15: Wire MatchCard + ProfileHero

**Files:**
- Modify: `apps/web/src/components/matchmaking/MatchCard.tsx`
- Modify: `apps/web/src/components/profile/ProfileHero.tsx`
- Modify: `apps/web/src/app/profiles/[profileId]/page.tsx`

- [ ] **Step 1: MatchCard — render distance pill + 1-line explainer**

In `MatchCard.tsx`, locate the city/age line and replace it. Pseudocode:

```tsx
import { DistancePill } from '../profile/DistancePill';

// inside the card body, replace the existing city span with:
<DistancePill distanceKm={item.distanceKm ?? null} fallbackCity={item.city} />

// below the score badge, add:
{item.explainer?.reasons[0] && (
  <p className="mt-1 line-clamp-1 text-[12px] text-slate-600">{item.explainer.reasons[0]}</p>
)}
```

- [ ] **Step 2: ProfileHero — add WhyMatchPanel slot**

In `ProfileHero.tsx`, accept new props:

```ts
explainer?: import('@smartshaadi/types').MatchExplainer | null;
viewerTier?: 'FREE' | 'STANDARD' | 'PREMIUM';
distanceKm?: number | null;
```

Below the existing photo overlay block, add:

```tsx
{explainer && (
  <div className="px-4 pt-3">
    <WhyMatchPanel explainer={explainer} tier={viewerTier ?? 'FREE'} />
  </div>
)}
```

Add the import at the top:

```tsx
import { WhyMatchPanel } from './WhyMatchPanel';
```

- [ ] **Step 3: Profile detail page wires them**

In `apps/web/src/app/profiles/[profileId]/page.tsx`, fetch the score and pass through. After the existing parallel fetch, add an explainer fetch (uses existing `/score/:profileId`):

```ts
const scoreResp = await fetch(`${apiBase}/api/v1/matchmaking/score/${profileId}`, {
  headers: { cookie: `...` }, // existing pattern in this file
  cache: 'no-store',
});
const scoreData = scoreResp.ok ? ((await scoreResp.json()) as { data?: { explainer?: import('@smartshaadi/types').MatchExplainer | null; distanceKm?: number | null } }).data : null;
```

Pass `explainer={scoreData?.explainer ?? null}`, `distanceKm={scoreData?.distanceKm ?? null}`, and `viewerTier={entitlements.tier}` to `<ProfileHero ... />`.

- [ ] **Step 4: Type-check + visual smoke**

```bash
pnpm --filter @smartshaadi/web type-check
pnpm dev
```

Open `/feed` → tap a card → verify WhyMatchPanel renders for STANDARD+, blurred for FREE; verify DistancePill shows km when nearby.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/matchmaking/MatchCard.tsx apps/web/src/components/profile/ProfileHero.tsx apps/web/src/app/profiles/
git commit -m "feat(web): wire DistancePill + WhyMatchPanel into MatchCard + ProfileHero"
```

---

## Task 16: Final verification

- [ ] **Step 1: Full type-check**

```bash
pnpm type-check
```

Expected: clean across all packages.

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

Expected: all green. Existing 277 + new tests for personality, filters, explainer, diversity, geocode.

- [ ] **Step 3: Boot smoke**

```bash
pnpm dev
```

In another terminal:

```bash
curl -s http://localhost:4000/api/v1/matchmaking/feed -H "cookie: shaadi.session=..." | jq '.data.items[0] | {distanceKm, explainer}'
```

Expected: each item has `distanceKm: number | null` and `explainer: { reasons, caveat }`.

- [ ] **Step 4: Cache invalidation**

Flush match feed cache so existing users see new fields:

```bash
redis-cli --scan --pattern 'match_feed:*' | xargs -r redis-cli DEL
```

- [ ] **Step 5: Final commit**

If any tail-end fixes accumulated, commit them with:

```bash
git add -A
git commit -m "chore(matchmaking): chunk-1 verification + cache flush"
```

---

## Self-review checklist (before marking complete)

- [ ] Spec coverage: every section in the design doc has at least one task above.
- [ ] No `TBD`, `TODO`, `implement later` strings in this plan.
- [ ] Type names match across tasks (`MatchExplainer`, `PersonalityProfile`, `MustHaveFlags`).
- [ ] Migration applied (`pnpm db:push`).
- [ ] Cache flushed post-deploy.
- [ ] FREE tier blur on WhyMatchPanel verified.
