# Week 11 · Step 2 — Family Inclination Index (FII)
## Smart Shaadi · Phase 3 Implementation Plan

**Baseline:** 3 Phase 3 features live in production (Coach, Emotional, DPI) · 533 api tests · 129 ai-service tests · all auto-deploying via Railway + Vercel
**Goal:** Soft compatibility hint visible to both parties — small badge on match card + full breakdown on match detail
**Agent strategy:** 2-teammate parallel build (Python + Node) → single agent for frontend
**Estimated output:** ~10 new pytest tests + ~6 Vitest tests · Card badge + detail panel
**Total wall time:** ~4-6 hours sequential, ~2-3 hours with parallel agents

---

## What's Different From DPI

| Aspect | DPI | FII |
|--------|-----|-----|
| **Visibility** | Private to requester | Both parties see same value |
| **Framing** | Risk-based (negative-leaning) | Trait-based (neutral/positive) |
| **ML** | sklearn LogisticRegression | None — pure rule-based scoring |
| **Synthetic data** | 1500 rows | None |
| **LLM** | Opus 4.7 always | Sonnet 4.6 hybrid (templates default) |
| **UX risk** | High — anxiety potential | Low — like browsing personality test |
| **Surfacing** | Single hidden link, opt-in | Card badge + detail breakdown |
| **Privacy** | Cache key requester-scoped | Cache key match-scoped (both see same) |

FII is the simplest of the three remaining Phase 3 features. No model training, no privacy minefield, no anxiety-aware UX. The challenge is making the rule-based scoring **feel** intelligent without being arbitrary.

---

## Pre-Flight Checklist

```bash
# 1. Tests still hold
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm --filter @smartshaadi/api test 2>&1 | tail -3
# Expect: 533 passed

cd apps/ai-service && ai-venv && pytest tests/ -v --tb=no -q 2>&1 | tail -3
# Expect: 129 passed

# 2. Production health
curl -s https://api.smartshaadi.co.in/health | python3 -m json.tool
# Expect: 200

# 3. Working tree clean
git status
# Expect: clean (or just FII plan file untracked)
```

---

## Research Decisions — Locked Before Coding

### Decision 1: Score Composition — 7 weighted signals

All from existing profile data. No new fields needed.

| # | Signal | Source | Weight | Encoding |
|---|--------|--------|--------|----------|
| 1 | `joint_family_preference` | profile.family_structure_preference | **20%** | "joint" → 100, "extended" → 75, "nuclear_close" → 50, "nuclear" → 25 |
| 2 | `parents_living_with` | profile.parents_living_situation | **18%** | "yes_committed" → 100, "open" → 70, "no_objection" → 50, "no_prefer_separate" → 20 |
| 3 | `family_decision_involvement` | profile.family_in_decisions | **15%** | "high_collaborative" → 100, "consultative" → 75, "informed_only" → 40, "independent" → 10 |
| 4 | `family_events_priority` | profile.cultural_events_attendance | **12%** | "always_attends" → 100, "important_only" → 70, "occasionally" → 40, "rarely" → 15 |
| 5 | `siblings_relationship_strength` | profile.sibling_closeness | **12%** | numeric 1-5 → linearly mapped to 0-100 |
| 6 | `religious_practice_with_family` | profile.religious_observance + family_religious | **13%** | "very_active_together" → 100, "active" → 75, "occasional" → 50, "personal_only" → 25 |
| 7 | `geographic_proximity_to_family` | profile.willing_distance_from_family_km | **10%** | "<50km" → 100, "50-200" → 70, "200-500" → 40, "500+" → 15 |

**Final score** = weighted sum, clamped 0-100.

### Decision 2: Label Bands

| Score Range | Label | Color | Tone |
|-------------|-------|-------|------|
| 80-100 | **Family-First** | Burgundy `#7B2D42` | Strongly family-centered |
| 60-79 | **Family-Oriented** | Warm Gold `#C5A47E` | Family is core but balanced |
| 40-59 | **Balanced** | Peacock Teal `#0E7C7B` | Neither extreme — balanced family/independence |
| 20-39 | **Independent-Leaning** | Sage `#7FA682` | Family valued, independence prioritized |
| 0-19 | **Independent** | Muted Gray `#6B6B76` | Independent life chosen |

**Critical UX constraint:** None of these labels are negative. "Independent" is not "anti-family" — it's a valid life choice. The labels reflect preference, not virtue.

### Decision 3: Compatibility Calculation Between Two Profiles

FII is per-profile, but **what users care about is compatibility**. So we compute:

```python
profile_a_score = 78  # Family-Oriented
profile_b_score = 35  # Independent-Leaning

compatibility_delta = abs(78 - 35)  # 43

if delta <= 15: "Highly Aligned" (green Sage)
if delta <= 30: "Mostly Aligned" (Warm Gold)  
if delta <= 50: "Worth Discussing" (Peacock Teal — neutral, not alarming)
if delta > 50: "Different Outlooks" (Muted Gray — informative, not negative)
```

The badge on the match card shows **compatibility**, not the raw score. The detail page shows both raw scores + the compatibility framing.

### Decision 4: Hybrid Narrative Strategy

**Template path (default — 95% of calls):**

```python
TEMPLATES = {
    ('Family-First', 'Family-First'): "You both value family deeply, with similar approaches to involvement and tradition. This shared foundation often makes life decisions easier.",
    ('Family-First', 'Family-Oriented'): "You both place family at the center of your lives. Small differences in approach are normal and worth discussing.",
    ('Family-Oriented', 'Balanced'): "You value family connection, while {match_name} balances family with personal independence. Conversations about expectations help both feel respected.",
    # ... 15 total combinations (5 labels × 5 labels, but symmetric)
}
```

**Sonnet path (5% of calls — only when user opens detail page):**

The match detail page tries to fetch a Sonnet-generated personalized narrative. If LLM fails or `USE_MOCK_SERVICES=true`, falls back to template. Cache aggressively (24h Redis).

Why hybrid:
- Match card badges shown for 50+ matches per user — Sonnet on every card = $$$
- Detail page is opened for 2-5 matches per user — Sonnet adds real value
- Templates ensure feature works even with no Anthropic key

### Decision 5: Caching — Match-Scoped, Both Sides Same

```
Score cache: fii:profile:{profileId} → individual score (24h TTL)
Compat cache: fii:match:{matchId} → compatibility + narrative (24h TTL)
```

Match-scoped is correct here because both sides see the same compatibility value. No requester-scoping needed (unlike DPI).

### Decision 6: Where FII Lives in the UI

**Surface 1 — Match Card Badge** (across browse, search results, accepted matches):

```
[Profile Photo]
Anjali, 28
Software Engineer, Pune
[FII Badge: "Highly Aligned" Sage]   ← here
[Other existing match metadata]
```

Subtle, single-pill, never the visual focal point.

**Surface 2 — Match Detail / Compatibility Page:**

Below the existing DPI Compatibility Analysis disclaimer + gauge, add a new section:

```
─────────────────────────────────
Family & Lifestyle Outlook
─────────────────────────────────

[Your FII bar: 78, Family-Oriented]
[Their FII bar: 35, Independent-Leaning]

Compatibility: Worth Discussing

[Narrative — template or Sonnet]

[Optional: factor breakdown collapsed by default]
```

### Decision 7: Bull Job — Same Pattern as Emotional Score

```typescript
// jobs/fiiScoreJob.ts
// Schedule: cron daily at "30 21 * * *" UTC = 3am IST (after Emotional 2am, after DPI 3am — staggered)

async function processBatch() {
  // 1. Get all profiles modified in last 7 days
  // 2. For each: compute FII score → cache 24h
  // 3. For each ACCEPTED match where both profiles fresh: compute compatibility → cache 24h
  // 4. Concurrency 5 (no LLM in batch path)
}
```

### Decision 8: Agent Team Split

| Phase | Agent | Domain | Files |
|-------|-------|--------|-------|
| Phase 1A (parallel) | `ai-python-fii` | FII calculator + Sonnet narrative | `services/fii_service.py`, `routers/fii.py`, `schemas/fii.py`, `tests/test_fii.py`, `prompts/fii-narrative-v1.md` |
| Phase 1B (parallel) | `api-node-fii` | API endpoint + Bull job + score helper | `routes/ai.ts`, `services/aiService.ts`, `services/fiiScore.ts`, `jobs/fiiScoreJob.ts`, `__tests__/ai.fii.test.ts` |
| Phase 2 (sequential) | Single agent | Card badge + detail panel | `components/fii/FiiCardBadge.client.tsx`, `components/fii/FiiDetailPanel.client.tsx`, `app/actions/ai.ts`, match card components |

**No Phase 0** — there's no model to train. Saves us 30-45 min vs DPI.

---

## Phase 1A — Agent Teammate: `ai-python-fii`

```
You are teammate ai-python-fii. You own the Python ai-service work for FII —
calculator, compatibility, and Sonnet narrative path.

FILES YOU OWN — touch nothing outside this list:
  apps/ai-service/src/routers/fii.py                  (CREATE)
  apps/ai-service/src/services/fii_service.py         (CREATE)
  apps/ai-service/src/schemas/fii.py                  (CREATE)
  apps/ai-service/tests/test_fii.py                   (CREATE)
  prompts/fii-narrative-v1.md                         (CREATE)
  apps/ai-service/src/main.py                         (EDIT — register router only)

DO NOT TOUCH:
  apps/api/, apps/web/, packages/
  Existing routers (coach, emotional, dpi, horoscope) — read-only

────────────────────────────────────────────────────────────────────
STEP 1: prompts/fii-narrative-v1.md

System prompt for Sonnet 4.6 (NOT Opus). FII is lower stakes than DPI.

Required:
- Tone: warm, observational, never judgemental about family choices
- "Independent" is NOT lesser than "family-oriented" — both are valid
- Output XML:
  <narrative>1-2 sentences observing the alignment patterns</narrative>
  <discussion_starter>One specific topic to discuss</discussion_starter>
- 3-shot examples:
  Example 1: both Family-First → encouraging shared foundation
  Example 2: Balanced + Family-Oriented → minor differences worth surfacing
  Example 3: Family-First + Independent-Leaning → bigger difference, framed as "different paths to happiness"

Forbidden words: "incompatible", "wrong", "fail", "doomed", "should", "must"

────────────────────────────────────────────────────────────────────
STEP 2: schemas/fii.py

from pydantic import BaseModel, Field
from typing import Literal

class FiiSignals(BaseModel):
    joint_family_preference: int = Field(ge=0, le=100)
    parents_living_with: int = Field(ge=0, le=100)
    family_decision_involvement: int = Field(ge=0, le=100)
    family_events_priority: int = Field(ge=0, le=100)
    siblings_relationship_strength: int = Field(ge=0, le=100)
    religious_practice_with_family: int = Field(ge=0, le=100)
    geographic_proximity_to_family: int = Field(ge=0, le=100)

FII_LABELS = ['Independent', 'Independent-Leaning', 'Balanced', 'Family-Oriented', 'Family-First']
COMPAT_LABELS = ['Highly Aligned', 'Mostly Aligned', 'Worth Discussing', 'Different Outlooks']

class FiiProfileScore(BaseModel):
    score: int = Field(ge=0, le=100)
    label: str  # one of FII_LABELS
    breakdown: dict[str, int]  # signal name → individual contribution

class FiiCompatibilityRequest(BaseModel):
    profile_a: FiiSignals
    profile_b: FiiSignals
    profile_a_name: str = Field(default="", max_length=100)
    profile_b_name: str = Field(default="", max_length=100)
    use_llm_narrative: bool = Field(default=False)  # Sonnet only when true

class FiiCompatibilityResponse(BaseModel):
    profile_a_score: FiiProfileScore
    profile_b_score: FiiProfileScore
    delta: int  # |a - b|
    compatibility: str  # one of COMPAT_LABELS
    compatibility_color: str  # hex color
    narrative: str
    discussion_starter: str
    narrative_source: Literal['template', 'sonnet']

────────────────────────────────────────────────────────────────────
STEP 3: services/fii_service.py

Implement:

WEIGHTS = {
    'joint_family_preference': 0.20,
    'parents_living_with': 0.18,
    'family_decision_involvement': 0.15,
    'family_events_priority': 0.12,
    'siblings_relationship_strength': 0.12,
    'religious_practice_with_family': 0.13,
    'geographic_proximity_to_family': 0.10,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 0.01  # weights must sum to 1

def compute_individual_score(signals: FiiSignals) -> FiiProfileScore:
    """Weighted sum, clamp 0-100, map to label band."""
    score = sum(getattr(signals, k) * w for k, w in WEIGHTS.items())
    score = max(0, min(100, round(score)))
    label = label_for_score(score)
    breakdown = {k: round(getattr(signals, k) * w) for k, w in WEIGHTS.items()}
    return FiiProfileScore(score=score, label=label, breakdown=breakdown)

def label_for_score(score: int) -> str:
    if score >= 80: return 'Family-First'
    if score >= 60: return 'Family-Oriented'
    if score >= 40: return 'Balanced'
    if score >= 20: return 'Independent-Leaning'
    return 'Independent'

COLOR_MAP = {
    'Highly Aligned': '#7FA682',     # Sage
    'Mostly Aligned': '#C5A47E',     # Warm Gold
    'Worth Discussing': '#0E7C7B',   # Peacock Teal (neutral, not alarming)
    'Different Outlooks': '#6B6B76', # Muted Gray
}

def compatibility_label(delta: int) -> tuple[str, str]:
    if delta <= 15: label = 'Highly Aligned'
    elif delta <= 30: label = 'Mostly Aligned'
    elif delta <= 50: label = 'Worth Discussing'
    else: label = 'Different Outlooks'
    return label, COLOR_MAP[label]

# Templates dict — 15 entries (symmetric, so (A,B) == (B,A))
TEMPLATES = {
    frozenset(['Family-First', 'Family-First']): {
        'narrative': "You both place family at the heart of your lives. This shared foundation often eases major decisions and builds deep mutual support.",
        'discussion_starter': "Talk about how you each picture an ideal family gathering or tradition you'd want to continue."
    },
    # ... 14 more entries
    # Naming: when both are same → 5 entries
    # When different → 10 entries (5 choose 2)
    # Use frozenset as key so order doesn't matter
}

def get_template(label_a: str, label_b: str) -> dict:
    """Returns dict with 'narrative' and 'discussion_starter'."""
    key = frozenset([label_a, label_b])
    return TEMPLATES.get(key, {
        'narrative': "Your family outlooks differ in some ways. Conversations about lifestyle preferences will help you understand each other.",
        'discussion_starter': "Share what family time means to each of you — daily, weekly, on holidays."
    })

async def compute_compatibility(
    request: FiiCompatibilityRequest,
    anthropic_client,
    use_mock: bool
) -> FiiCompatibilityResponse:
    """
    1. Compute both individual scores
    2. delta = abs(a.score - b.score)
    3. Get compatibility label + color
    4. If request.use_llm_narrative AND not use_mock AND anthropic_client:
       - Try Sonnet 4.6 with prompts/fii-narrative-v1.md
       - On any failure → fall through to template
    5. Otherwise → use template
    6. Return full response
    """

────────────────────────────────────────────────────────────────────
STEP 4: routers/fii.py

POST /ai/fii/compatibility
Auth: verify_internal_key
Returns: FiiCompatibilityResponse

Register in main.py: app.include_router(fii_router)

────────────────────────────────────────────────────────────────────
STEP 5: tests/test_fii.py

Mock anthropic client. Use deterministic test fixtures.

Minimum 10 tests:
1. test_compute_individual_score_all_max_returns_family_first_label
2. test_compute_individual_score_all_min_returns_independent_label
3. test_label_band_boundaries (5 boundary cases)
4. test_compatibility_label_band_boundaries (15, 30, 50)
5. test_template_lookup_order_independent (frozenset ensures (A,B)==(B,A))
6. test_compute_compatibility_returns_full_shape
7. test_use_llm_narrative_false_returns_template_source
8. test_use_llm_narrative_true_with_mock_returns_template_source (USE_MOCK_SERVICES=true skips LLM)
9. test_llm_failure_falls_back_to_template_silently
10. test_breakdown_sums_to_score_within_tolerance
11. test_no_forbidden_words_in_template_narratives (verify all 15 templates clean)

────────────────────────────────────────────────────────────────────
VERIFICATION:
  cd apps/ai-service && source ~/venvs/smart-shaadi-ai/bin/activate
  pytest tests/test_fii.py -v
  pytest tests/ -v
  Expect: 129 baseline + 10+ new fii tests = 139+ passing

When done:
- Create .ai-python-fii-done at repo root
- Commit: "feat(ai-service): FII compatibility router + Sonnet hybrid narrative + 10 tests"
- Reply: "ai-python-fii done — N tests, commit hash"

NO plan approval mode. Implement directly.
```

---

## Phase 1B — Agent Teammate: `api-node-fii`

```
You are teammate api-node-fii. You own the Node.js API work for FII.

FILES YOU OWN — touch nothing outside this list:
  apps/api/src/routes/ai.ts                            (EDIT — add FII routes ONLY)
  apps/api/src/services/aiService.ts                   (EDIT — add FII client)
  apps/api/src/services/fiiScore.ts                    (CREATE — feature extractor)
  apps/api/src/jobs/fiiScoreJob.ts                     (CREATE)
  apps/api/src/__tests__/ai.fii.test.ts                (CREATE)

DO NOT TOUCH:
  apps/ai-service/, apps/web/, packages/
  Existing coach/emotional/dpi routes
  Other route files

────────────────────────────────────────────────────────────────────
STEP 1: services/fiiScore.ts

Feature extraction from profile data. Maps user-submitted profile fields
to the 7 normalized 0-100 signals required by ai-service.

export async function extractFiiSignals(profile: Profile): Promise<FiiSignals> {
  /**
   * Map profile fields to 0-100 signals per Decision 1 of the plan.
   * 
   * Profile fields used (verify with packages/db schema):
   *   - family_structure_preference (enum)
   *   - parents_living_situation (enum)
   *   - family_in_decisions (enum)
   *   - cultural_events_attendance (enum)
   *   - sibling_closeness (numeric 1-5)
   *   - religious_observance + family_religious (enums)
   *   - willing_distance_from_family_km (numeric)
   * 
   * If a field is null/missing → default to 50 (neutral middle).
   * Function MUST be deterministic for same inputs (caching depends on it).
   */
}

────────────────────────────────────────────────────────────────────
STEP 2: services/aiService.ts (extend existing)

export async function getFiiCompatibility(
  profileA: FiiSignals,
  profileB: FiiSignals,
  profileANameMasked: string,
  profileBNameMasked: string,
  useLlmNarrative: boolean = false
): Promise<FiiCompatibilityResponse> {
  // POST to ${AI_SERVICE_URL}/ai/fii/compatibility
  // X-Internal-Key auth
  // 8s timeout (template path is <100ms; LLM path can take 2-3s)
}

────────────────────────────────────────────────────────────────────
STEP 3: routes/ai.ts — TWO new endpoints

GET /api/v1/ai/fii/score/:profileId
  Auth: requireSession
  Rate limit: 60/hour/user (Redis INCR + EXPIRE)
  
  1. Resolve profile, verify it exists
  2. Try cache: GET fii:profile:{profileId}
  3. If miss: extractFiiSignals → call aiService for individual score → cache 24h
  4. Return { success, data: { score, label, breakdown } }

GET /api/v1/ai/fii/compatibility/:matchId
  Auth: requireSession
  Rate limit: 30/hour/user
  Query param: ?detailed=true (triggers Sonnet narrative path)
  
  1. Resolve userId → profileId
  2. Verify match participation (either side allowed — both can see)
  3. Try cache: GET fii:match:{matchId}:{detailed?'sonnet':'template'}
  4. If miss:
     - extractFiiSignals for both profiles
     - useLlmNarrative = (detailed === true)
     - Call aiService.getFiiCompatibility()
     - Cache 24h (or 1h if Sonnet narrative)
  5. Return { success, data: full compatibility response }

────────────────────────────────────────────────────────────────────
STEP 4: jobs/fiiScoreJob.ts

Schedule: cron "30 21 * * *" UTC = 3am IST (staggered after Emotional 2am, DPI 3am)

processBatch():
  1. Get all profiles modified in last 7 days
  2. For each: extractFiiSignals → call aiService for individual score → cache 24h
  3. Get all ACCEPTED matches where both profiles' scores were fresh
  4. For each: cache template-path compatibility (NEVER call LLM in batch — too expensive)
  5. Concurrency 5

Use existing BullMQ queue. Don't create new queue.

────────────────────────────────────────────────────────────────────
STEP 5: tests/__tests__/ai.fii.test.ts

Minimum 6 tests:
1. test_score_unauth_returns_401
2. test_score_returns_200_with_shape (mocked aiService)
3. test_score_returns_cached_value_on_hit
4. test_compatibility_unauth_returns_401
5. test_compatibility_non_participant_returns_403
6. test_compatibility_detailed_param_triggers_sonnet_path
7. test_compatibility_default_uses_template_path
8. test_extractFiiSignals_handles_missing_fields_gracefully (null → 50 fallback)

Use mocks pattern from existing ai.coach.test.ts and ai.dpi.test.ts.

────────────────────────────────────────────────────────────────────
VERIFICATION:
  pnpm --filter @smartshaadi/api test
  Expect: 533 baseline + 6+ new fii tests = 539+ passing
  pnpm --filter @smartshaadi/api type-check (zero errors)
  pnpm --filter @smartshaadi/api lint (zero errors)

When done:
- Create .api-node-fii-done at repo root
- Commit: "feat(api): FII score + compatibility endpoints + Bull job + 6 tests"
- Reply: "api-node-fii done — N tests, commit hash"

NO plan approval mode.
```

---

## Phase 2 — Single Agent: Frontend (Card Badge + Detail Panel)

```
Both teammates done. Verify backend before building UI.

# 1. ai-service direct
curl -X POST http://localhost:8000/ai/fii/compatibility \
  -H "X-Internal-Key: dev-internal-key-change-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_a":{"joint_family_preference":85,"parents_living_with":80,"family_decision_involvement":75,"family_events_priority":85,"siblings_relationship_strength":70,"religious_practice_with_family":80,"geographic_proximity_to_family":90},
    "profile_b":{"joint_family_preference":75,"parents_living_with":70,"family_decision_involvement":65,"family_events_priority":80,"siblings_relationship_strength":75,"religious_practice_with_family":70,"geographic_proximity_to_family":80},
    "use_llm_narrative":false
  }' | python3 -m json.tool
# Expect: both Family-Oriented or Family-First, Highly Aligned compatibility

# 2. Auth boundary
curl -s -o /dev/null -w "no-auth: HTTP %{http_code}\n" \
  http://localhost:4000/api/v1/ai/fii/compatibility/test-match
# Expect: 401

────────────────────────────────────────────────────────────────────
FILES IN SCOPE:
  packages/types/src/ai.ts                                          (EDIT — add FII types)
  apps/web/src/app/actions/ai.ts                                    (EDIT — add 2 fetch helpers)
  apps/web/src/components/fii/FiiCardBadge.client.tsx               (CREATE)
  apps/web/src/components/fii/FiiDetailPanel.client.tsx             (CREATE)
  apps/web/src/components/matching/AcceptedMatchCard.tsx            (EDIT — add badge)
  apps/web/src/components/matching/MatchCard.tsx                    (EDIT — add badge)
  apps/web/src/components/matchmaking/MatchCard.tsx                 (EDIT — add badge if used in matchmaking flow)
  apps/web/src/app/(app)/matches/[id]/compatibility/page.tsx        (EDIT — append FII detail section below DPI)

DO NOT touch:
  apps/api/, apps/ai-service/
  Other web pages or unrelated components

────────────────────────────────────────────────────────────────────
STEP 1: Types (packages/types/src/ai.ts)

export interface FiiBreakdown {
  joint_family_preference: number
  parents_living_with: number
  family_decision_involvement: number
  family_events_priority: number
  siblings_relationship_strength: number
  religious_practice_with_family: number
  geographic_proximity_to_family: number
}

export interface FiiProfileScore {
  score: number
  label: 'Independent' | 'Independent-Leaning' | 'Balanced' | 'Family-Oriented' | 'Family-First'
  breakdown: FiiBreakdown
}

export interface FiiCompatibility {
  profile_a_score: FiiProfileScore
  profile_b_score: FiiProfileScore
  delta: number
  compatibility: 'Highly Aligned' | 'Mostly Aligned' | 'Worth Discussing' | 'Different Outlooks'
  compatibility_color: string  // hex
  narrative: string
  discussion_starter: string
  narrative_source: 'template' | 'sonnet'
}

────────────────────────────────────────────────────────────────────
STEP 2: Server actions (apps/web/src/app/actions/ai.ts)

'use server'
export async function fetchFiiCompatibility(
  matchId: string,
  detailed: boolean = false
): Promise<FiiCompatibility | null> {
  // GET /api/v1/ai/fii/compatibility/:matchId?detailed={detailed}
  // Same cookie auth pattern as fetchDpi
  // Return null on error (badge will hide)
}

────────────────────────────────────────────────────────────────────
STEP 3: FiiCardBadge.client.tsx — small badge for cards

Props: { matchId: string }

States:
  - loading: render NOTHING (don't show skeleton on cards — too noisy)
  - error/null: render NOTHING (graceful hide)
  - success: render small pill

Pill design:
  Inline-flex, h-6, px-2.5, rounded-full, text-[11px], font-medium
  Background: compatibility_color with /15 opacity overlay
  Text: compatibility label
  Border: 1px solid compatibility_color with /30 opacity
  
Example markup:
  <span className="inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium border"
        style={{ 
          backgroundColor: `${color}26`,  // 15% opacity hex
          borderColor: `${color}4D`,     // 30% opacity hex
          color: color
        }}>
    {compatibility}
  </span>

Mobile (375px): unchanged sizing — already compact.

────────────────────────────────────────────────────────────────────
STEP 4: FiiDetailPanel.client.tsx — full breakdown for detail page

Props: { matchId: string }

Render:
  Section title: "Family & Lifestyle Outlook" in Playfair Display, Burgundy text
  Two horizontal bars showing scores:
    [Your name]: ━━━━━━━━━░ 78  Family-Oriented
    [Their name]: ━━━░░░░░░ 35  Independent-Leaning
  
  Compatibility pill (larger than card badge):
    {compatibility} — colored

  Narrative paragraph (Inter, leading-relaxed)
  
  "💬 Try discussing:" + discussion_starter (italic)
  
  <details className="mt-4 border-t pt-3">
    <summary>See what shapes this score</summary>
    <div>{breakdown for each signal, translated names}</div>
  </details>

translateSignalName:
  joint_family_preference → "Family structure preference"
  parents_living_with → "Living with parents"
  family_decision_involvement → "Family in life decisions"
  family_events_priority → "Cultural events & celebrations"
  siblings_relationship_strength → "Closeness with siblings"
  religious_practice_with_family → "Shared religious practices"
  geographic_proximity_to_family → "Distance from family"

Loading state: skeleton bars
Error state: "We couldn't analyze family outlook right now."

────────────────────────────────────────────────────────────────────
STEP 5: Edit match cards (3 files)

Find existing match card components. Add <FiiCardBadge matchId={request.id} />
to each card in a sensible location — usually next to existing compatibility 
badges or below the name + city line.

Card files to edit:
  apps/web/src/components/matching/AcceptedMatchCard.tsx
  apps/web/src/components/matching/MatchCard.tsx (if it has match.id available)
  apps/web/src/components/matchmaking/MatchCard.tsx (if it has match.id available)

If MatchCard variants don't have a match.id prop available, skip them — only 
add to AcceptedMatchCard for v1. Note in commit message which were skipped.

────────────────────────────────────────────────────────────────────
STEP 6: Edit compatibility detail page

apps/web/src/app/(app)/matches/[id]/compatibility/page.tsx

Below the existing DPI section (gauge + factor breakdown), add:
  <Suspense fallback={<FiiPanelSkeleton />}>
    <FiiDetailPanel matchId={params.id} />
  </Suspense>

Use detailed=true so the panel triggers the Sonnet narrative path (since user opened the detail).

────────────────────────────────────────────────────────────────────
VERIFICATION:
  pnpm --filter @smartshaadi/web type-check
  pnpm --filter @smartshaadi/web lint
  pnpm test (baselines hold)
  
  Manual smoke (describe in commit, don't perform):
  1. Navigate to /matches list → AcceptedMatchCards show small FII compatibility badge
  2. Open compatibility detail page → DPI section + below it, FII section with both score bars
  3. FII narrative shows actual text (template in mock mode, Sonnet when keys live)
  4. Mobile 375px: badge fits on cards, detail panel readable

When done:
- Delete .ai-python-fii-done and .api-node-fii-done
- Commit: "feat(web): FII card badges + detail panel"
- Reply: "Step 2 (FII) complete — ready for git push and Railway verify"
```

---

## Production Deploy

```bash
# WSL
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git log --oneline -8
```

```powershell
# PowerShell
cd "D:\Do Not Open\vivah\vivahOS"
git push origin main
```

Railway redeploys vivah + ai-service. Vercel redeploys web. ~3 min total.

After deploy:

```bash
# Auth boundaries
curl -s -o /dev/null -w "score:   HTTP %{http_code}\n" \
  https://api.smartshaadi.co.in/api/v1/ai/fii/score/test-profile

curl -s -o /dev/null -w "compat:  HTTP %{http_code}\n" \
  https://api.smartshaadi.co.in/api/v1/ai/fii/compatibility/test-match
# Both expect: 401
```

---

## Verification Checklist

```
[ ] ai-python-fii: 10+ new tests pass, 139+ total
[ ] api-node-fii: 6+ new tests, 539+ total
[ ] Frontend type-check 0, lint 0 new
[ ] /health unchanged (FII has no model status to report)
[ ] POST /ai/fii/compatibility returns valid response with 7-signal breakdown
[ ] GET /api/v1/ai/fii/score/:profileId — 401 unauth, 404 missing profile, 200 valid
[ ] GET /api/v1/ai/fii/compatibility/:matchId — 401 unauth, 403 non-participant, 200 valid
[ ] Match list page: small FII compatibility badge appears on each AcceptedMatchCard
[ ] Compatibility detail page: FII section appears BELOW DPI section
[ ] Both score bars render with correct colors per label
[ ] Compatibility pill never shows alarmist colors (red avoided across all bands)
[ ] Mobile 375px: badge fits without overflow, detail panel readable
[ ] USE_MOCK_SERVICES=true: narrative shows template, narrative_source: "template"
[ ] When real keys: detailed=true triggers Sonnet path, narrative_source: "sonnet"
[ ] Both sides of a match see the SAME compatibility value (verified manually)
[ ] No forbidden words in any FII UI files (run grep before commit)
```

---

## What's Next After FII

After Week 11 Step 2 (FII) ships:

**Week 12 Step 1 — Function Attendance Quotient (FAQ)**
- sklearn GradientBoostingClassifier on synthetic RSVP data
- 5 features: relationship_type, distance, rsvp_response, ceremony_type, historical_attendance_rate
- Predicts guest attendance probability for wedding planning
- Used in catering/seating estimates, NOT in matrimonial matching
- ~1.5 days work (similar shape to DPI but simpler model + lower stakes UX)

**Week 12 Step 2 — Stay Quotient**
- sklearn LogisticRegression on usage signals
- ADMIN-ONLY (never visible to users)
- Drives churn-prevention notifications
- ~1 day work

**Week 13 — Phase 3 Hardening**
- Rate limit audit
- Helicone observability check
- Mock mode completeness sweep
- Error boundary review
- QA checklist
- ~2 days
