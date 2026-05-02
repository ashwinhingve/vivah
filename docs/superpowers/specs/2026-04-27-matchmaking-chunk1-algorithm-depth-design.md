# Matchmaking Core — Chunk 1: Algorithm Depth + Explainability

**Date:** 2026-04-27
**Owner:** Ashwin Hingve
**Status:** Approved — ready for plan
**Roadmap position:** 1 of 6 (see "Roadmap" section)

---

## Roadmap (parent project)

The matchmaking overhaul is decomposed into six independent sub-specs. Each gets its own design → plan → implementation cycle.

| # | Sub-spec | Depends on |
|---|----------|-----------|
| 1 | **Algorithm depth + explainability** (this doc) | none |
| 2 | Personalization + freshness loop | 1 |
| 3 | Daily curation + mutual surfaces | 1, 2 |
| 4 | Astrology depth | 1 |
| 5 | Search + saved searches | 1 |
| 6 | AI/ML semantic match | 1, 2 |

---

## 1. Goal

Upgrade the matchmaking core from a five-dimension deterministic scorer to a six-dimension scorer with personality alignment, distance-based geo filter, deal-breaker promotion, MMR diversity reranking, and a deterministic "why this match" explainer. All ML-free.

## 2. Non-goals

- No behavior-signal capture, no weight learning. (Chunk 2.)
- No daily picks, no mutual surfaces. (Chunk 3.)
- No nakshatra / dasha / kuja-dosha. (Chunk 4.)
- No saved searches. (Chunk 5.)
- No semantic embeddings, no LLM calls. (Chunk 6.)
- No user-facing weight slider — weights stay static config in this chunk; Chunk 2 makes them per-user learned.

## 3. Decisions

| Topic | Choice | Rationale |
|---|---|---|
| Personality dim | Likert 6-axis Euclidean distance | Deterministic, ML-free, fits 375px UI |
| Distance | Replace city/state with radius (haversine), state-fallback when coords missing | Modern UX; OSM/Nominatim free at signup |
| Deal-breakers | Per-pref `mustHave` flag in partnerPreferences | Bilateral hard-filter when set |
| Weight tuning | Static config registry | Chunk 2 will swap to user-learned weights |
| Explainer | Deterministic top-3 reasons + 1 caveat | No LLM. Computed from scorer breakdown deltas |
| MMR | λ = 0.7 over caste/occupation/city/age-bucket | Prevents same-cluster feed dominance |

## 4. Scorer refactor

### 4.1 New 6-dimension model (weights sum to 100)

| Dim key | Weight | Was | Notes |
|---|---|---|---|
| `demographicAlignment` | 20 | 25 | -5 to make room for personality |
| `lifestyleCompatibility` | 15 | 20 | -5 |
| `careerEducation` | 15 | 15 | unchanged |
| `familyValues` | 15 | 20 | -5 |
| `preferenceOverlap` | 20 | 20 | unchanged |
| **`personalityFit`** | **15** | NEW | new dim |

Guna bonus stays as `+0..5` add-on. Total clamped to 100.

### 4.2 Registry pattern

Scorer becomes:

```ts
type ScorerDimension = {
  key: keyof CompatibilityBreakdown
  weight: number
  fn: (user: ProfileData, candidate: ProfileData) => number  // returns 0..weight
}

const SCORER_REGISTRY: ScorerDimension[] = [...]
```

`scoreCandidate()` iterates the registry, builds breakdown, sums totals. This makes Chunk 2's per-user weight injection a one-line change (`buildRegistry(weights)`).

### 4.3 `personalityFit` formula

Inputs:
- Both profiles have `personality: { axis1..axis6 }`, each integer 1..7.
- Optional `userPrefs.personalityIdeal: { axis: number, tolerance: number }` per axis (Chunk 2 will auto-populate; Chunk 1 reads if present).

Compute:
1. If either profile lacks `personality` → return score = 7 (≈ half of 15, rounded down) and add flag `personality_pending` on the parent `CompatibilityScore`.
2. For each axis, `delta = |user.axis - candidate.axis|`. Clip to `tolerance ?? 6`.
3. `normalized = sqrt(sum(delta^2)) / sqrt(6 * 6^2)` → in [0,1].
4. Score = `round(15 * (1 - normalized))` → in [0..15].

### 4.4 New ProfileData fields used by scorer

```ts
personality?: {
  introvertExtrovert: number   // 1..7
  traditionalModern: number
  plannerSpontaneous: number
  religiousSecular: number
  ambitiousBalanced: number
  familyIndependent: number
}
latitude?: number
longitude?: number
```

`preferences` extended with:

```ts
maxDistanceKm?: number          // default 100
personalityIdeal?: Partial<{
  introvertExtrovert: { value: number, tolerance: number }
  // ... 5 more
}>
mustHave?: Partial<Record<MustHaveKey, boolean>>
```

`MustHaveKey = 'age' | 'religion' | 'education' | 'income' | 'diet' | 'manglik' | 'caste' | 'distance'`

## 5. Filter changes

### 5.1 Distance filter replaces location filter

- Implements **haversine** in km.
- **Bilateral**: pair passes when `dist <= min(user.maxDistanceKm, candidate.maxDistanceKm)`.
- **Fallback**: when either side has no coords → fall back to current city/state match logic. This keeps existing data working without backfill.
- Engine attaches `distanceKm: number | null` to every `MatchFeedItem`.

### 5.2 mustHave promotion to hard filter

For each existing soft-or-hard filter, if **either side** sets `mustHave.X = true`, promote to bilateral hard filter. Three groups:

**Group A — already strictly hard; flag is documentation/UI only (no behavior change):**

| Key | Existing rule |
|---|---|
| `age` | candidate within user's prefAgeMin..prefAgeMax |
| `income` | candidate income range overlaps user's pref range |

**Group B — flag bypasses an existing escape hatch:**

| Key | Without flag | With flag |
|---|---|---|
| `religion` | `openToInterfaith` skips check | strict equality, ignore `openToInterfaith` |
| `caste` | `openToInterCaste` skips check | strict equality, ignore `openToInterCaste` |
| `manglik` | only enforced if user's pref ≠ `ANY` | always enforced (treat missing pref as `NON_MANGLIK`) |
| `distance` | falls back to city/state when coords missing | hard-fail when either side missing coords |

**Group C — flag promotes a soft-only signal to hard filter:**

| Key | Without flag | With flag |
|---|---|---|
| `education` | scored softly inside `preferenceOverlap` | candidate degree must be in user's `pref.education` list |
| `diet` | scored softly inside `preferenceOverlap` | candidate diet must be in user's `pref.diet` list |

Bilateral semantics: if user.mustHave.education is true, the candidate must satisfy user's education list AND user must satisfy candidate's education list (when candidate also set the same flag — otherwise candidate's side stays soft).

### 5.3 Filter file structure

```
filters.ts
├─ applyHardFilters(user, candidates) → ProfileWithPreferences[]
├─ passesAgeFilter
├─ passesReligionFilter        // checks mustHave.religion
├─ passesDistanceFilter        // NEW, replaces passesLocationFilter
├─ passesIncomeFilter
├─ passesEducationFilter       // NEW, only when mustHave.education
├─ passesDietFilter             // NEW, only when mustHave.diet
├─ passesCasteFilter            // checks mustHave.caste
├─ passesGotraFilter            // unchanged
└─ passesManglikFilter           // checks mustHave.manglik
```

## 6. Explainer

New file: `apps/api/src/matchmaking/explainer.ts`

```ts
export type MatchExplainer = {
  reasons: string[]   // length 0..3
  caveat: string | null
}

export function explainMatch(
  user: ProfileData,
  candidate: ProfileData,
  score: CompatibilityScore,
  distanceKm: number | null,
): MatchExplainer
```

### Algorithm

1. For each dimension in the breakdown, compute `fillRatio = score / max`.
2. Reasons = top-3 dimensions with `fillRatio >= 0.7`, mapped to a deterministic phrase.
3. Caveat = the single dimension with the lowest `fillRatio` if it is `< 0.4`; else null.

### Phrase templates

| Dim | Phrase logic |
|---|---|
| demographicAlignment | If sameCity → "Both in {city}" + (distance ? ", {n}km apart" : ""). Else if ageDiff ≤ 2 → "Same age group". Else if sameReligion → "Same religion ({religion})" |
| lifestyleCompatibility | If sameDiet → "Both {diet}". Else if vegSpectrum → "Compatible diets". Else "Aligned lifestyle" |
| careerEducation | If sameOccCat → "Both in {category}". Else if sameTier → "Similar education level" |
| familyValues | If sameFamilyType → "Same family setup ({type})". Else "Aligned family values" |
| preferenceOverlap | "Strong preference match" |
| personalityFit | "Compatible personalities" |

### Caveat templates

| Dim | Caveat |
|---|---|
| demographicAlignment | "Different cities" or "Wide age gap" |
| lifestyleCompatibility | "Different lifestyles" |
| careerEducation | "Different fields/education" |
| familyValues | "Different family setups" |
| preferenceOverlap | "Limited preference overlap" |
| personalityFit | "Different personalities" |

## 7. MMR diversity rerank

New file: `apps/api/src/matchmaking/diversity.ts`

```ts
export function mmrRerank(
  scored: MatchFeedItem[],
  λ: number = 0.7,
  k: number = 50,
): MatchFeedItem[]
```

### Algorithm

Cluster vector for profile = `{caste, occupationCategory, city, ageBucket}` where `ageBucket = floor(age/5)`.

Greedy MMR:
1. Pick the highest-scoring profile, add to `picked`.
2. For each remaining profile, compute `mmrScore = λ * (totalScore/100) - (1-λ) * maxJaccardSim(profile, picked)`.
3. Pick the profile with the highest mmrScore. Repeat until `k` items chosen or feed exhausted.

`maxJaccardSim` over cluster vectors (each is a 4-element set of strings).

Applied between `scoreAndRank` and feed cache write inside `computeAndCacheFeed`.

## 8. Geocoding

New file: `apps/api/src/lib/geocode.ts`

```ts
export async function geocode(city: string, state: string, country?: string): Promise<{ lat: number, lng: number } | null>
```

- Backend: Nominatim public API (`https://nominatim.openstreetmap.org/search`). User-Agent header required.
- In-memory LRU cache: 1000 entries.
- Mock mode (`USE_MOCK_SERVICES`): deterministic hash → seed table of 10 IN city centroids (Mumbai, Delhi, Bangalore, Pune, Hyderabad, Chennai, Kolkata, Ahmedabad, Jaipur, Lucknow). Unknown city → fall back to state centroid; unknown state → null.
- Called by `apps/api/src/profiles/service.ts` whenever the location section changes.

## 9. Schema changes

### 9.1 Postgres — new migration `0005_*.sql`

```sql
ALTER TABLE profiles ADD COLUMN latitude  numeric(9,6);
ALTER TABLE profiles ADD COLUMN longitude numeric(9,6);
CREATE INDEX profiles_lat_lng_idx ON profiles (latitude, longitude);
```

### 9.2 MongoDB ProfileContent — new sections

```ts
personality?: {
  introvertExtrovert: number   // 1..7
  traditionalModern: number
  plannerSpontaneous: number
  religiousSecular: number
  ambitiousBalanced: number
  familyIndependent: number
}

partnerPreferences.maxDistanceKm?: number    // default 100
partnerPreferences.personalityIdeal?: Record<axis, { value: number, tolerance: number }>
partnerPreferences.mustHave?: Record<MustHaveKey, boolean>
```

No migration needed for Mongo — additive optional fields.

### 9.3 Shared types

`packages/types/src/profile.ts`:
- Add personality block, mustHave, maxDistanceKm, personalityIdeal, latitude, longitude.

`packages/types/src/matching.ts`:
- `MatchFeedItem`: add `distanceKm: number | null`, `explainer: MatchExplainer | null`.
- `CompatibilityBreakdown`: add `personalityFit: { score, max }`.

## 10. UI surfaces

### 10.1 Onboarding

- New step: `apps/web/src/app/(onboarding)/profile/personality/page.tsx`
  - 6 sliders (Range 1..7), single submit button.
  - Wired to `apps/web/src/app/(onboarding)/profile/actions.ts` → POST /me/personality.
  - Step appears after `lifestyle`, before `preferences`.

- Preferences step gets:
  - "Must have" star toggle on each preference field.
  - Distance slider (10..500km) replacing city/state pickers.
  - Optional "ideal personality" sliders + tolerance picker.

### 10.2 Match feed

- `MatchCard` (web component): below score badge, single-line explainer (first reason). Distance pill ("12 km away") replaces city when distance < 50km.
- `ProfileHero`: new "Why you match" panel — 3 reasons + 1 caveat — gated to `STANDARD+` (FREE sees a blurred preview with UpgradeCTA).

### 10.3 New components

- `apps/web/src/components/profile/WhyMatchPanel.tsx`
- `apps/web/src/components/profile/DistancePill.tsx`

## 11. API surface changes

| Endpoint | Change |
|---|---|
| `GET /matchmaking/feed` | Items now include `distanceKm`, `explainer` (FREE tier gets `explainer: null`) |
| `GET /matchmaking/score/:profileId` | Response includes `explainer` field |
| `POST /profiles/me/personality` | NEW. Validates Likert ranges, upserts `profiles_content.personality` |
| `PATCH /profiles/me/preferences` | Accepts new `mustHave`, `maxDistanceKm`, `personalityIdeal` |
| `POST /profiles/me/location` (existing) | Now also geocodes and writes lat/lng to Postgres |

## 12. Files to create / modify

### New files

- `apps/api/src/matchmaking/explainer.ts`
- `apps/api/src/matchmaking/diversity.ts`
- `apps/api/src/matchmaking/personality.ts`
- `apps/api/src/lib/geocode.ts`
- `apps/api/src/matchmaking/__tests__/explainer.test.ts`
- `apps/api/src/matchmaking/__tests__/diversity.test.ts`
- `apps/api/src/matchmaking/__tests__/personality.test.ts`
- `apps/api/src/lib/__tests__/geocode.test.ts`
- `packages/db/migrations/0005_*.sql`
- `apps/web/src/app/(onboarding)/profile/personality/page.tsx`
- `apps/web/src/components/profile/WhyMatchPanel.tsx`
- `apps/web/src/components/profile/DistancePill.tsx`

### Modified files

- `apps/api/src/matchmaking/scorer.ts` — registry refactor + personalityFit
- `apps/api/src/matchmaking/filters.ts` — distance + mustHave + education/diet hard
- `apps/api/src/matchmaking/engine.ts` — geocode-aware row converter, MMR step, explainer attach
- `apps/api/src/matchmaking/router.ts` — explainer in /score response
- `apps/api/src/profiles/router.ts` — POST /me/personality endpoint
- `apps/api/src/profiles/service.ts` — geocode on location save, personality save
- `apps/web/src/components/matchmaking/MatchCard.tsx` — explainer line + DistancePill
- `apps/web/src/components/profile/ProfileHero.tsx` — WhyMatchPanel
- `apps/web/src/app/(onboarding)/profile/actions.ts` — savePersonality
- `apps/web/src/app/profiles/[profileId]/page.tsx` — wire WhyMatchPanel
- `packages/types/src/matching.ts` — explainer + distanceKm + personalityFit
- `packages/types/src/profile.ts` — personality + mustHave + maxDistanceKm
- `packages/schemas/src/profile.ts` — Zod for personality + mustHave

## 13. Testing strategy

### Unit

- **scorer**
  - Personality euclidean: identical → 15, max-distance → 0.
  - Registry sums to 100 + guna bonus 0..5.
  - Missing personality → flag `personality_pending`, score 7.
- **filters**
  - mustHave.education promotes soft to hard.
  - distance bilateral: passes only when both sides within their max.
  - distance fallback to state when one side missing coords.
  - mustHave.distance disables fallback.
- **diversity**
  - λ=1 → identical to score order.
  - λ=0 → maximally diverse, ignores score.
  - λ=0.7 → mix; near-clones not adjacent in top 10.
- **explainer**
  - 3 high-fill dims → 3 reasons.
  - 1 dim < 40% fill → caveat present.
  - All dims weak → reasons = [], caveat present.
- **geocode**
  - Mock mode determinism: same city → same coords across calls.
  - Unknown city + known state → state centroid.
  - Unknown both → null.

### Integration

- `engine.test.ts` — feed contains distanceKm + explainer; MMR shuffles vs raw score.

### Smoke

- Manual: complete personality step, verify feed reflects updated explainer + distance.

## 14. Migration / rollout plan

1. Ship migration 0005 in pre-step (fields nullable; safe).
2. Backfill: opt-in batch script that calls geocode for existing profiles with city+state. Out of scope for this chunk; defer to ops.
3. Invalidate all `match_feed:*` and `match_scores:*` Redis keys on deploy (one-line Redis SCAN + DEL hook in deploy script).
4. Personality step is **optional** in onboarding (skippable). New profiles without personality still match — they receive neutral score + `personality_pending` flag.

## 15. Open questions (none blocking)

- Should `STANDARD` see distance < 50km only, with FREE seeing city only? Decision: no — distance is a free signal.
- Should explainer be cached in Redis? Decision: no for v1 — computed per render is cheap (< 1ms per pair).

## 16. Acceptance criteria

- [ ] `pnpm type-check` passes clean across all packages.
- [ ] `pnpm test` passes (existing 277 tests + new tests for personality, diversity, explainer, geocode).
- [ ] Migration 0005 applies cleanly via `pnpm db:push`.
- [ ] /feed returns items with `distanceKm` + `explainer` populated.
- [ ] /score includes `explainer` in response.
- [ ] Onboarding personality step renders, persists, and feeds back into score.
- [ ] FREE tier sees blurred WhyMatchPanel; STANDARD+ sees full panel.
- [ ] MatchCard shows distance pill when distance < 50km, city otherwise.
