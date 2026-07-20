# Week 11 · Step 1 — Divorce Probability Indicator (DPI)
## Smart Shaadi · Phase 3 Implementation Plan

**Baseline:** Week 10 Step 1 + 2 shipped to production · 628 tests passing · ai-service Online · vivah Online · Coach + Emotional Score live
**Goal:** Privacy-first compatibility risk indicator visible only to the requesting user, never their match
**Agent strategy:** 3-phase build (model training → 2-teammate parallel API+frontend → integration smoke)
**Estimated output:** ~12 new pytest tests + ~8 Node tests · DPI gauge with disclaimer in match detail page

---

## ⚠️ Why This Plan Has More Upfront Research Than Coach/Emotional

DPI differs from previous features in ways that demand careful design BEFORE coding:

| Concern | Coach/Emotional | DPI |
|---------|----------------|-----|
| **Privacy scope** | Both participants see same value | Only requesting user — match never sees their score |
| **UX risk** | Low — playful suggestions, gentle badge | **High** — score can cause anxiety, damage trust |
| **Model output** | Clear positive signal | Probability of failure — inherently negative framing |
| **Training data** | Pre-trained HuggingFace / hardcoded mocks | Custom sklearn on synthetic data, retrain on real |
| **Display** | Visible, encouraged | **Opt-in expand**, disclaimers required |
| **LLM use** | Sonnet 4.6 for live coaching | Opus 4.7 for narrative explanation only |

If we build DPI like Coach (open by default, prominent, no disclaimers), we will hurt users. The cost of getting this wrong is real psychological harm to people in arranged-marriage decisions. We design conservatively.

---

## Pre-Flight Checklist

```bash
# 1. Baseline tests still hold
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm test
# Expect: 523/523 api · 91+/91+ schemas · pytest 105+

# 2. ai-service local boots, sentiment model loads
cd apps/ai-service && ai-venv
uvicorn src.main:app --port 8000 &
sleep 5 && curl -s http://localhost:8000/health | python3 -m json.tool
# Expect: phase: 3, models.coach: "llm_sonnet", models.emotional: "huggingface_loaded", models.dpi: "pending..."
kill %1

# 3. Production health
curl -s https://api.smartshaadi.co.in/health
# Expect: 200 OK
```

If any fails → fix before proceeding.

---

## Research Decisions — Locked Before Coding Starts

### Decision 1: Model Choice — sklearn LogisticRegression

Five candidates considered:

| Model | Why considered | Why rejected |
|-------|----------------|--------------|
| LogisticRegression | Interpretable, fast, calibrated probabilities, well-suited for binary outcome | ✅ **CHOSEN** |
| RandomForestClassifier | Higher accuracy on synthetic data | Less interpretable; we need to show factor contributions |
| XGBoost | Best raw performance | Overkill for 10 features; harder to deploy |
| Neural network (PyTorch) | Could capture non-linear patterns | Way too complex for synthetic-data Phase 1 |
| Bayesian network | Best for uncertainty quantification | Implementation complexity, sklearn doesn't ship one |

LogisticRegression chosen because:
1. **Calibrated probabilities** — output 0.34 actually means "34% chance" (most other models output uncalibrated scores)
2. **Coefficient interpretability** — each factor's contribution is a single number, easy to display
3. **Fast inference** — <5ms per prediction, suitable for both nightly batch and on-demand
4. **Stable on small training data** — logistic regression doesn't overfit synthetic data the way trees do
5. **Well-understood** — sklearn's implementation is battle-tested

### Decision 2: Synthetic Training Data — 1500 rows, balanced

```
def generate_synthetic_data(n=1500):
    """
    Generate training data with realistic factor distributions and a 
    plausible (NOT real) label generation rule.
    
    Goal: produce a model that gives sensible relative scores, not 
    one that claims to predict actual divorce. Disclaimer in UI is mandatory.
    """
    # Mix of risk profiles:
    # - 40% low-risk (compatible across most factors)
    # - 35% medium-risk (some friction)  
    # - 25% high-risk (multiple incompatibilities)
    
    # Label generation rule (not "truth", just realistic correlation):
    # base_risk = 0.10 (everyone has some baseline)
    # + 0.04 per year of age gap above 5
    # + 0.15 if education_gap == 'LARGE_GAP'
    # + 0.20 * income_disparity_pct (normalized)
    # + 0.10 * (1 - family_values_alignment / 4)
    # + ... etc
    # Then noise: random.gauss(0, 0.08)
    # Final: clamp to [0, 1], threshold at 0.5 for binary outcome label
    
    # The model learns this rule from data, then can generalize to 
    # new inputs. Coefficients will be roughly proportional to the 
    # factor weights above, which IS the design intent.
```

The model is honest: it's a structured opinion expressed via logistic regression, trained on synthetic data that encodes domain knowledge about Indian arranged marriage patterns. **It does not predict divorce — it reflects compatibility risk patterns.**

### Decision 3: 10 Factors — All from existing profile data

| # | Factor | Source | Range / Encoding |
|---|--------|--------|------------------|
| 1 | `age_gap_years` | Both profiles | abs(age_a - age_b) → normalize: 0-3 = 0.0, 3-7 = 0.3, 7-12 = 0.6, 12+ = 1.0 |
| 2 | `education_gap` | Both profiles' education field | SAME = 0.0, ONE_STEP = 0.3, TWO_STEP = 0.6, LARGE_GAP = 1.0 (e.g., PhD vs HighSchool) |
| 3 | `income_disparity_pct` | Both profiles' income range | abs(a - b) / max(a, b), capped at 1.0 |
| 4 | `family_values_alignment` | Both profiles' family_values field | overlap of values arrays / max length, inverted → 0.0 = perfect, 1.0 = no overlap |
| 5 | `lifestyle_compatibility` | diet + smoking + drinking | weighted sum of 3 binary mismatches, normalized to [0, 1] |
| 6 | `communication_score` | Emotional Score current value | (100 - emotional_score) / 100 (high emotional score = low risk) |
| 7 | `guna_milan_score` | Existing horoscope calc | (36 - guna_score) / 36 (high guna = low risk) |
| 8 | `geographic_distance_km` | City coords (Haversine) | 0-50km = 0.1, 50-200 = 0.3, 200-500 = 0.5, 500-1000 = 0.7, 1000+ = 1.0 |
| 9 | `religion_caste_match` | Both profiles + user preferences | SAME = 0.0, COMPATIBLE = 0.4 (per user pref), DIFFERENT = 0.8 |
| 10 | `preference_match_pct` | A's stated preferences vs B's actual attributes | 1 - (matched_count / total_count) |

**All factors normalized to [0.0, 1.0] where 0.0 = lowest risk, 1.0 = highest risk.** This makes coefficient interpretation trivial.

### Decision 4: Privacy Architecture — Strict Single-Side Visibility

The hardest decision. Three privacy layers:

**Layer 1: API endpoint enforces requester ownership**
```typescript
// In apps/api/src/routes/ai.ts
GET /api/v1/ai/divorce-indicator/:matchId

// Handler:
const requesterProfileId = await resolveProfileId(req.user.id)
const match = await db.select().from(matchRequests).where(eq(matchRequests.id, matchId))

// Both sides participate in the match, but only the requester's view of DPI is computed
// The OTHER side, if they request DPI, gets a DIFFERENT computation (their preferences vs requester's actual attributes)
// 
// BOTH sides see DPI, but each sees their OWN view — they may differ
```

**Layer 2: Redis cache scoped to requester, not match**
```
// Wrong (would let match steal cached value via timing attack):
"dpi:{matchId}" 

// Right:
"dpi:{requesterUserId}:{matchId}"
```

**Layer 3: Logging discipline**
```typescript
// Sentry/PostHog logs include event name + requester anonymized hash
// NEVER include: raw DPI score, factor breakdown, match identity in log payload
// Use bucket: "low" | "medium" | "high" only
```

### Decision 5: UX — Anxiety-Aware Design

The badge UX from Emotional Score is wrong for DPI. We need:

1. **Hidden by default** — DPI lives behind a "View detailed compatibility analysis" button on a new "Compatibility" tab on match detail page
2. **Opt-in expansion** — clicking the button shows the gauge + factor breakdown
3. **No alarmist colors** — gauge uses neutral palette (Sage → Gold → Soft Coral), NOT (Green → Yellow → Red)
4. **Reframed labels** — instead of "HIGH RISK", say "Areas to discuss". Instead of "LOW RISK", say "Strong foundation"
5. **Disclaimer banner ABOVE gauge, not below** — "This analysis reflects compatibility patterns from comparable profiles. Every relationship is unique. Use as one input among many."
6. **Narrative > number** — show 1-2 sentence Opus-generated summary first; raw probability only on hover

**Color mapping (deliberately NOT red/green):**
- Score ≤ 0.30 → Sage `#7FA682` "Strong Foundation" 
- Score 0.30–0.55 → Warm Gold `#C5A47E` "Some Areas to Discuss"
- Score > 0.55 → Burgundy `#7B2D42` "Important Conversations Needed"

Note: even at HIGH risk, language is action-oriented ("conversations needed") not predictive ("likely to fail").

### Decision 6: Opus 4.7 for Narrative — Not Sonnet

Coach uses Sonnet 4.6 (realtime, latency-sensitive). DPI uses Opus 4.7 because:
- Latency tolerance is high (user clicked "View Analysis", expects to wait 3-5s)
- Quality of explanation matters far more — wrong tone here = real harm
- Output is short (1-2 sentences) so cost per call is low (~$0.02)
- Opus 4.7 follows nuanced tone guidance better than Sonnet for sensitive topics

**Prompt strategy:** Heavy system prompt with explicit DO/DON'T list, structured XML output, multiple tone examples.

### Decision 7: Caching Strategy — 24h TTL, requester-scoped

```
Key: dpi:{requesterUserId}:{matchId}
Value: { score, level, factors, narrative, computed_at }
TTL: 24h
```

DPI doesn't change rapidly (no message-driven updates like Emotional Score). Recompute when:
- Manual refresh by user (rate-limited 5/day per user)
- Profile material changes (new income, new family_values)
- Daily Bull job recomputes for any match where requester logged in last 7 days (to keep relevant cache warm)

**Rate limit: 5 DPI requests per user per day.** Lower than Emotional Score because:
- Compute cost includes Opus 4.7 narrative (~$0.02 each)
- Repeat requests for same match are uncommon legitimate use
- Rate limit forces user to read the result, not refresh-spam

### Decision 8: Bull Job — Daily Refresh Strategy

```typescript
// jobs/dpiRefreshJob.ts
// Schedule: daily 3am IST (after Emotional Score 2am job completes)

async function processBatch() {
  // Get all profile pairs where ONE side logged in within last 7 days
  // For each (logged_in_user, their_match), compute DPI from that user's perspective
  // Write to Redis with 25h TTL
  // Total ~50-200 matches per day, batch concurrency=3 (Opus is slower)
}
```

This pre-warms cache for active users without recomputing for everyone.

### Decision 9: Agent Team Split

Different from previous steps because of upfront model training:

| Phase | Agent | Domain | Files |
|-------|-------|--------|-------|
| Phase 0 (sequential) | Single | Synthetic data + model training | `services/dpi_model.py`, `services/dpi_training.py`, `tests/test_dpi_model.py` |
| Phase 1A (parallel with 1B) | `ai-python-dpi` | DPI router + Opus narrative | `routers/dpi.py`, `services/dpi_service.py`, `schemas/dpi.py`, `tests/test_dpi.py`, `prompts/dpi-narrative-v1.md` |
| Phase 1B (parallel with 1A) | `api-node-dpi` | Privacy-enforced API + Bull job | `routes/ai.ts`, `services/aiService.ts`, `jobs/dpiRefreshJob.ts`, `services/dpiPrivacy.ts`, `__tests__/ai.dpi.test.ts` |
| Phase 2 (sequential) | Single | Compatibility tab + gauge UI | `app/matches/[id]/compatibility/page.tsx`, `components/dpi/CompatibilityGauge.client.tsx`, `components/dpi/FactorBreakdown.client.tsx`, `actions/ai.ts` |

---

## Phase 0 — Single Agent: Model Training & Synthetic Data

*Sequential. Must complete before teammates spawn. ~30-45 minutes.*

```
TASK: Build sklearn LogisticRegression model for Divorce Probability Indicator,
trained on synthetic data with deterministic factor distributions.

Read docs/superpowers/plans/week11-step1-dpi-plan.md "Decision 1, 2, 3" sections in full.

────────────────────────────────────────────────────────────────────
STEP 1: apps/ai-service/src/services/dpi_training.py

def generate_synthetic_data(n: int = 1500, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (X, y) where:
      X: shape (n, 10) — features in [0, 1]
      y: shape (n,) — binary labels {0, 1}
    
    Distribution mix: 40% low-risk, 35% medium-risk, 25% high-risk
    
    Label rule (from Decision 2 above):
      base = 0.10
      + 0.04 * (max(0, age_gap_years*15 - 5)) for age_gap_years feature value
      + 0.15 * education_gap
      + 0.20 * income_disparity
      + 0.10 * family_values_alignment
      + 0.10 * lifestyle_compatibility
      + 0.10 * communication_score
      + 0.08 * guna_milan_score
      + 0.05 * geographic_distance
      + 0.10 * religion_caste_match
      + 0.10 * preference_match_pct
      + gaussian noise (mean=0, std=0.08)
      Threshold at 0.5 → binary label
    
    Use np.random.default_rng(seed) for reproducibility.
    Save to apps/ai-service/data/dpi_synthetic.csv (gitignored).

def train_model(save_path: str = 'models/dpi_model.pkl') -> dict:
    """
    1. Generate or load synthetic data
    2. Train sklearn.linear_model.LogisticRegression(C=1.0, max_iter=1000)
    3. Compute training metrics: accuracy, AUC-ROC, calibration
    4. Save model + metadata via joblib.dump
    5. Return metrics dict
    
    Model file structure:
      models/dpi_model.pkl     - trained LogisticRegression
      models/dpi_metadata.json - feature_names, training_date, metrics, version='1.0.0'
    """

────────────────────────────────────────────────────────────────────
STEP 2: apps/ai-service/src/services/dpi_model.py

FEATURE_NAMES = [
    'age_gap_years', 'education_gap', 'income_disparity_pct',
    'family_values_alignment', 'lifestyle_compatibility',
    'communication_score', 'guna_milan_score', 'geographic_distance_km',
    'religion_caste_match', 'preference_match_pct',
]

# Module-level singleton, lazy-loaded
_model = None
_metadata = None

def load_model():
    """
    Load model from models/dpi_model.pkl.
    If not found → call train_model() to generate it.
    Cache in module-level _model variable.
    Idempotent — safe to call repeatedly.
    """

def predict(features: dict) -> dict:
    """
    Input features dict with all 10 FEATURE_NAMES keys, each [0, 1] float.
    
    Returns:
    {
      'score': float (0.0 to 1.0, calibrated probability),
      'level': 'LOW' | 'MEDIUM' | 'HIGH' (thresholds 0.30, 0.55),
      'factor_contributions': {
        # For each feature, its contribution = coefficient * normalized_value
        'age_gap_years': 0.045,
        'education_gap': 0.123,
        ...
      },
      'top_3_factors': ['family_values_alignment', 'income_disparity_pct', 'age_gap_years']
        # ordered by absolute contribution
    }
    """

────────────────────────────────────────────────────────────────────
STEP 3: Update /health endpoint in apps/ai-service/src/main.py

After adding:
  models.dpi: "sklearn_loaded" if model loads successfully, else "sklearn_unavailable"

────────────────────────────────────────────────────────────────────
STEP 4: apps/ai-service/tests/test_dpi_model.py

Mock joblib at module level if needed for fast tests.

Minimum 8 tests:
1. test_synthetic_data_shape_and_balance
2. test_synthetic_data_label_distribution_reasonable (40-60% positive class)
3. test_train_model_saves_files (mock joblib.dump, verify call)
4. test_predict_returns_correct_shape
5. test_predict_score_in_valid_range_0_to_1
6. test_predict_low_risk_inputs_yield_low_score (all factors near 0)
7. test_predict_high_risk_inputs_yield_high_score (all factors near 1)
8. test_predict_factor_contributions_sum_to_score (within tolerance)
9. test_predict_top_3_factors_correctness
10. test_load_model_idempotent (call twice, second should hit cache)

────────────────────────────────────────────────────────────────────
STEP 5: Add to .gitignore (if not already)
  apps/ai-service/data/
  apps/ai-service/models/

────────────────────────────────────────────────────────────────────
VERIFICATION:
- pytest tests/test_dpi_model.py -v  # 10 passed
- pytest tests/ -v                    # 105+ baseline + 10 new = 115+ passing
- python -c "from src.services.dpi_model import load_model, predict; load_model(); print(predict({k: 0.5 for k in ['age_gap_years','education_gap','income_disparity_pct','family_values_alignment','lifestyle_compatibility','communication_score','guna_milan_score','geographic_distance_km','religion_caste_match','preference_match_pct']}))"
  # Should print a valid prediction dict

Commit: "chore(ai-service): DPI model trainer + synthetic data + 10 tests"
```

---

## Phase 1A — Agent Teammate: `ai-python-dpi`

```
You are teammate ai-python-dpi. You own the Python ai-service work for DPI's API endpoint
and Opus 4.7 narrative generation.

FILES YOU OWN — touch nothing outside this list:
  apps/ai-service/src/routers/dpi.py                  (CREATE)
  apps/ai-service/src/services/dpi_service.py         (CREATE)
  apps/ai-service/src/schemas/dpi.py                  (CREATE)
  apps/ai-service/tests/test_dpi.py                   (CREATE)
  prompts/dpi-narrative-v1.md                         (CREATE)
  apps/ai-service/src/main.py                         (EDIT — register router only)

DO NOT TOUCH:
  apps/api/, apps/web/, packages/
  services/dpi_model.py (Phase 0 owns it — read-only)
  services/dpi_training.py (Phase 0 owns it — do not modify)

────────────────────────────────────────────────────────────────────
STEP 1: prompts/dpi-narrative-v1.md

System prompt for Opus 4.7. CRITICAL — this prompt directly shapes user emotional response.

Required elements:
- Opens: "You are a thoughtful relationship counselor for Smart Shaadi, India's premium 
  matrimonial platform. You help users understand compatibility patterns in a way that 
  is supportive, balanced, and culturally appropriate."
- Sets cultural context: Indian arranged-marriage decisions, family-involved
- Forbidden words: "fail", "doomed", "incompatible", "wrong match", "divorce"
- Required tone: action-oriented, conversation-encouraging, never deterministic
- Output format: XML for parseable extraction
  <narrative>1-2 sentences explaining top concern(s) with empathetic framing</narrative>
  <suggestion>One specific topic to discuss with the match</suggestion>
- Must include: shared interests/strengths first, then areas to discuss
- Must NOT include: specific probability percentages or risk percentages
- 3-shot examples showing good vs bad output:
  Example 1: low risk → encouraging tone, focus on shared strengths
  Example 2: medium risk → balanced, name 2 areas with kind framing
  Example 3: high risk → still constructive, never alarmist

Sample good output:
  <narrative>You both share strong family values and similar life goals, which builds a
  solid foundation. Your different career paths and lifestyle preferences are areas where 
  open conversation will help you understand each other's expectations.</narrative>
  <suggestion>Talk about how you each imagine balancing career and family priorities five 
  years from now.</suggestion>

Sample bad output (DO NOT generate like this):
  ❌ "There is a 67% probability this match will fail" (probabilistic, alarming)
  ❌ "You are not compatible" (deterministic, hurtful)
  ❌ "This is a high-risk match" (clinical, scary)

────────────────────────────────────────────────────────────────────
STEP 2: apps/ai-service/src/schemas/dpi.py

from pydantic import BaseModel, Field
from typing import Literal

class DpiFeatures(BaseModel):
    age_gap_years: float = Field(ge=0, le=1)
    education_gap: float = Field(ge=0, le=1)
    income_disparity_pct: float = Field(ge=0, le=1)
    family_values_alignment: float = Field(ge=0, le=1)
    lifestyle_compatibility: float = Field(ge=0, le=1)
    communication_score: float = Field(ge=0, le=1)
    guna_milan_score: float = Field(ge=0, le=1)
    geographic_distance_km: float = Field(ge=0, le=1)
    religion_caste_match: float = Field(ge=0, le=1)
    preference_match_pct: float = Field(ge=0, le=1)

class DpiRequest(BaseModel):
    requesting_user_id: str
    match_id: str
    features: DpiFeatures
    profile_a_summary: str = Field(default="", max_length=500)  # for narrative context
    profile_b_summary: str = Field(default="", max_length=500)
    shared_strengths: list[str] = Field(default_factory=list, max_items=5)

class DpiFactorContribution(BaseModel):
    factor: str
    contribution: float
    direction: Literal['protective', 'concern', 'neutral']

class DpiResponse(BaseModel):
    score: float = Field(ge=0, le=1)
    level: Literal['LOW', 'MEDIUM', 'HIGH']
    label: str  # User-facing: "Strong Foundation" / "Some Areas to Discuss" / "Important Conversations Needed"
    narrative: str  # Opus-generated, 1-2 sentences
    suggestion: str  # Opus-generated, one specific topic
    top_factors: list[DpiFactorContribution]  # max 3
    disclaimer: str  # Always included

DISCLAIMER = (
    "This analysis reflects compatibility patterns from comparable profiles. "
    "Every relationship is unique. Use as one input among many."
)

LEVEL_LABELS = {
    'LOW': 'Strong Foundation',
    'MEDIUM': 'Some Areas to Discuss',
    'HIGH': 'Important Conversations Needed',
}

────────────────────────────────────────────────────────────────────
STEP 3: apps/ai-service/src/services/dpi_service.py

async def compute_dpi(
    request: DpiRequest,
    anthropic_client,
    use_mock: bool
) -> DpiResponse:
    """
    1. Call dpi_model.predict() with features → get score, level, factor_contributions
    2. Map level to label via LEVEL_LABELS
    3. Identify top 3 factors by absolute contribution
    4. For each top factor, classify direction:
         contribution < -0.05 → 'protective'
         contribution > +0.05 → 'concern'
         else → 'neutral'
    5. If use_mock=True → return MOCK_NARRATIVE based on level, skip LLM
    6. Otherwise: call Opus 4.7 via Helicone-routed Anthropic client
       model='claude-opus-4-7'
       max_tokens=400
       temperature=0.5  (more deterministic for sensitive content)
       Helicone headers:
         Helicone-Property-Feature: dpi-narrative
         Helicone-User-Id: request.requesting_user_id (anonymized hash, not raw)
         Helicone-Cache-Enabled: true
       
       Prompt:
         system = load prompts/dpi-narrative-v1.md
         user = f"Match level: {level}\nProfile A: {profile_a_summary}\nProfile B: {profile_b_summary}\n
                 Top factors of concern: {top_factors_summary}\n
                 Shared strengths: {shared_strengths}\n
                 Generate narrative + suggestion."
    7. Parse XML for <narrative> and <suggestion>
    8. On any LLM exception → fall back to MOCK_NARRATIVE for that level
    9. Return DpiResponse with all fields populated

MOCK_NARRATIVES = {
    'LOW': {
        'narrative': 'You share strong family values and have similar life perspectives. This is a great foundation for a meaningful relationship.',
        'suggestion': 'Continue discussing your shared interests and life goals to deepen your understanding of each other.'
    },
    'MEDIUM': {
        'narrative': 'You have several compatible traits and some differences worth exploring together. Open conversations about these areas will help you understand each other better.',
        'suggestion': 'Spend time discussing your views on family roles and how you each imagine your future home life.'
    },
    'HIGH': {
        'narrative': 'You have meaningful connections in some areas and notable differences in others. Honest conversations about these differences are important to understand if your visions align.',
        'suggestion': 'Have a thoughtful discussion about your core values and long-term life expectations before moving forward.'
    },
}

────────────────────────────────────────────────────────────────────
STEP 4: apps/ai-service/src/routers/dpi.py

from fastapi import APIRouter, Depends
from app.deps.auth import verify_internal_key
from app.schemas.dpi import DpiRequest, DpiResponse
from app.services.dpi_service import compute_dpi
from app.core.config import settings

router = APIRouter(prefix="/ai/dpi", tags=["dpi"])

@router.post("/compute", response_model=DpiResponse)
async def compute(
    request: DpiRequest,
    _: None = Depends(verify_internal_key)
) -> DpiResponse:
    return await compute_dpi(
        request,
        anthropic_client=...,  # from app state
        use_mock=settings.USE_MOCK_SERVICES
    )

Register in src/main.py: app.include_router(dpi_router)

────────────────────────────────────────────────────────────────────
STEP 5: apps/ai-service/tests/test_dpi.py

Mock anthropic client and dpi_model. Use MagicMock with .return_value.

Minimum 12 tests:
1. test_compute_dpi_low_risk_returns_strong_foundation_label
2. test_compute_dpi_medium_risk_returns_areas_to_discuss
3. test_compute_dpi_high_risk_returns_important_conversations
4. test_disclaimer_always_included
5. test_top_factors_max_3_returned
6. test_factor_direction_protective_for_negative_contribution
7. test_factor_direction_concern_for_positive_contribution
8. test_mock_mode_skips_llm_returns_canned_narrative
9. test_llm_exception_falls_back_to_mock_narrative_silently
10. test_xml_parsing_handles_malformed_response_gracefully
11. test_score_clamped_to_0_1_range
12. test_label_matches_level_via_LEVEL_LABELS_dict

────────────────────────────────────────────────────────────────────
VERIFICATION:
- pytest tests/test_dpi.py -v   # 12 passed
- pytest tests/ -v               # 115+ baseline + 12 new = 127+ passing

When done:
- Create .ai-python-dpi-done at repo root
- Commit: "feat(ai-service): DPI router + Opus narrative + 12 tests"
- Reply: "ai-python-dpi done — 12 tests, commit hash"

NO plan approval mode. Implement directly.
```

---

## Phase 1B — Agent Teammate: `api-node-dpi`

```
You are teammate api-node-dpi. You own the Node.js API work for DPI with strict
privacy enforcement.

FILES YOU OWN — touch nothing outside this list:
  apps/api/src/routes/ai.ts                            (EDIT — add DPI route)
  apps/api/src/services/aiService.ts                   (EDIT — add DPI client function)
  apps/api/src/services/dpiPrivacy.ts                  (CREATE — privacy enforcement)
  apps/api/src/services/dpiFeatures.ts                 (CREATE — feature extraction from profiles)
  apps/api/src/jobs/dpiRefreshJob.ts                   (CREATE)
  apps/api/src/__tests__/ai.dpi.test.ts                (CREATE)

DO NOT TOUCH:
  apps/ai-service/, apps/web/, packages/
  Existing coach/emotional routes
  Other route files

────────────────────────────────────────────────────────────────────
STEP 1: apps/api/src/services/dpiPrivacy.ts

Privacy enforcement module — ALL DPI access goes through these helpers.

export class DpiPrivacyError extends AppError {
  constructor(message: string) { super('DPI_PRIVACY_VIOLATION', message, 403) }
}

export async function assertRequesterParticipation(
  requesterProfileId: string,
  matchId: string,
  db: typeof drizzleDb
): Promise<{ requesterIsRequester: boolean; otherProfileId: string }> {
  /**
   * Verify the requester is a participant in the match.
   * Return which side they're on and the other profile's ID.
   * Throw DpiPrivacyError if not a participant.
   * 
   * CRITICAL: only ACCEPTED matches are eligible for DPI.
   * PENDING/REJECTED matches return 404 (not 403) to prevent existence leaks.
   */
}

export function buildCacheKey(requesterUserId: string, matchId: string): string {
  // SCOPED to userId, not match — prevents the other side from accessing same cache
  return `dpi:${requesterUserId}:${matchId}`
}

export function sanitizeForLogging(response: DpiResponse, requesterUserId: string): object {
  /**
   * Never log raw DPI scores or factor breakdowns to Sentry/PostHog.
   * Return safe object with: anonymized requester hash, level bucket, computed_at.
   */
  return {
    requester_hash: createHash('sha256').update(requesterUserId).digest('hex').slice(0, 12),
    level: response.level,  // LOW/MEDIUM/HIGH bucket OK to log
    computed_at: response.computed_at,
    // NEVER include: score, narrative, factors
  }
}

────────────────────────────────────────────────────────────────────
STEP 2: apps/api/src/services/dpiFeatures.ts

Feature extraction from PostgreSQL + MongoDB.

export async function extractFeatures(
  profileA: Profile,
  profileB: Profile,
  matchId: string
): Promise<DpiFeatures> {
  /**
   * Compute all 10 normalized [0,1] features from profile data.
   * 
   * Features 1-5: pure profile comparison (age, education, income, family_values, lifestyle)
   * Feature 6 (communication_score): fetch current Emotional Score from Redis, 
              if missing → default 0.5
   * Feature 7 (guna_milan_score): fetch from existing horoscope calculator, 
              if missing → default 0.5
   * Feature 8 (geographic_distance_km): Haversine via existing util
   * Feature 9 (religion_caste_match): use requester's stated preferences
   * Feature 10 (preference_match_pct): how many of A's stated prefs B meets
   * 
   * CRITICAL: function MUST be deterministic for same inputs. Caching depends on this.
   */
}

────────────────────────────────────────────────────────────────────
STEP 3: apps/api/src/services/aiService.ts (extend existing)

export async function getDivorceProbability(
  requestingUserId: string,
  matchId: string,
  features: DpiFeatures,
  profileSummaries: { a: string; b: string },
  sharedStrengths: string[]
): Promise<DpiResponse> {
  // POST to ${AI_SERVICE_URL}/ai/dpi/compute
  // X-Internal-Key header required
  // 15s timeout (Opus 4.7 narrative is ~3-5s)
  // On error → throw AppError with code 'AI_SERVICE_UNAVAILABLE'
}

────────────────────────────────────────────────────────────────────
STEP 4: apps/api/src/routes/ai.ts (add DPI route)

GET /api/v1/ai/divorce-indicator/:matchId

Auth: requireSession (Better Auth cookie)
Rate limit: 5 per user per DAY (Redis INCR with day-bucket key)

Handler:
1. const userId = req.user.id  // Better Auth session
2. const requesterProfileId = await resolveProfileId(userId)
3. const { otherProfileId } = await assertRequesterParticipation(
     requesterProfileId, matchId, db
   )  // throws DpiPrivacyError if not participant
4. const cacheKey = buildCacheKey(userId, matchId)
5. const cached = await redis.get(cacheKey)
   if (cached AND not expired) return JSON.parse(cached)
6. const profileA = await db.profiles.findOne({ id: requesterProfileId })
   const profileB = await db.profiles.findOne({ id: otherProfileId })
7. const features = await extractFeatures(profileA, profileB, matchId)
8. const sharedStrengths = await computeSharedStrengths(profileA, profileB)
   // simple set intersection of family_values + life_goals + interests, max 5
9. const response = await aiService.getDivorceProbability(
     userId, matchId, features, 
     { a: summarize(profileA), b: summarize(profileB) },
     sharedStrengths
   )
10. await redis.set(cacheKey, JSON.stringify(response), 'EX', 86400)  // 24h
11. logger.info('dpi.computed', sanitizeForLogging(response, userId))
12. return { success: true, data: response }

Error handlers:
- DpiPrivacyError → 403 with code, message
- AppError('AI_SERVICE_UNAVAILABLE') → return 200 with fallback:
  { score: 0.5, level: 'MEDIUM', label: 'Some Areas to Discuss', 
    narrative: '<MOCK_NARRATIVES.MEDIUM.narrative>', 
    suggestion: '<MOCK_NARRATIVES.MEDIUM.suggestion>',
    top_factors: [], disclaimer: DISCLAIMER, fallback: true }
- Match not found / not ACCEPTED → 404 (NOT 403, prevents existence leak)
- Rate limit exceeded → 429 with retry-after

────────────────────────────────────────────────────────────────────
STEP 5: apps/api/src/jobs/dpiRefreshJob.ts

Schedule: cron daily at "0 21 * * *" UTC = 3am IST
(Runs after Emotional Score 2am job completes)

async function processBatch() {
  // 1. Get users who logged in within last 7 days from PostgreSQL
  // 2. For each user, get their ACCEPTED matches
  // 3. For each (user, match) pair, compute and cache DPI
  //    Concurrency: 3 (Opus is slower)
  //    Skip if cache key exists and < 12h old (don't waste Opus calls)
  // 4. Log summary: "Processed N user-match pairs in Mms"
}

Use existing BullMQ queue infrastructure. Don't create new queue.

────────────────────────────────────────────────────────────────────
STEP 6: apps/api/src/__tests__/ai.dpi.test.ts

Mock all dependencies. Patterns from ai.coach.test.ts and ai.emotional.test.ts.

Minimum 8 tests:
1. test_unauth_returns_401
2. test_non_participant_returns_403_with_DPI_PRIVACY_VIOLATION
3. test_pending_match_returns_404_NOT_403 (existence privacy)
4. test_valid_request_returns_200_with_full_response
5. test_cache_hit_returns_cached_response_no_ai_service_call
6. test_ai_service_failure_returns_fallback_with_fallback_true_flag
7. test_rate_limit_5_per_day_returns_429_on_6th_request
8. test_response_never_includes_other_user_id (privacy assertion)
9. test_logging_uses_sanitized_payload (no raw score in logs)
10. test_extract_features_returns_all_10_normalized

────────────────────────────────────────────────────────────────────
VERIFICATION:
- pnpm --filter @smartshaadi/api type-check  # 0 errors
- pnpm --filter @smartshaadi/api lint        # 0 errors
- pnpm --filter @smartshaadi/api test        # 523 baseline + 10+ new = 533+ passing

When done:
- Create .api-node-dpi-done at repo root
- Commit: "feat(api): DPI endpoint with privacy enforcement + Bull job + 10 tests"
- Reply: "api-node-dpi done — 10 tests, commit hash"

NO plan approval mode. Implement directly.
```

---

## Phase 2 — Single Agent: Compatibility Tab UI

```
Both teammates done. Verify backend:

# 1. ai-service direct
curl -s -X POST http://localhost:8000/ai/dpi/compute \
  -H "X-Internal-Key: dev-internal-key-change-in-prod" \
  -H "Content-Type: application/json" \
  -d '{
    "requesting_user_id":"user-1",
    "match_id":"match-1",
    "features":{"age_gap_years":0.2,"education_gap":0.0,"income_disparity_pct":0.1,"family_values_alignment":0.1,"lifestyle_compatibility":0.0,"communication_score":0.2,"guna_milan_score":0.1,"geographic_distance_km":0.0,"religion_caste_match":0.0,"preference_match_pct":0.1},
    "profile_a_summary":"",
    "profile_b_summary":"",
    "shared_strengths":[]
  }' | python3 -m json.tool
# Expect: low score, level: LOW, label: "Strong Foundation", narrative present

# 2. api proxy (will need session for full test)
curl -s -o /dev/null -w "no-auth: HTTP %{http_code}\n" \
  http://localhost:4000/api/v1/ai/divorce-indicator/test-match
# Expect: 401

If both pass → build frontend.

────────────────────────────────────────────────────────────────────
FILES IN SCOPE:
  apps/web/src/app/matches/[id]/compatibility/page.tsx              (CREATE)
  apps/web/src/components/dpi/CompatibilityGauge.client.tsx         (CREATE)
  apps/web/src/components/dpi/FactorBreakdown.client.tsx            (CREATE)
  apps/web/src/components/dpi/CompatibilityDisclaimer.tsx           (CREATE)
  apps/web/src/app/actions/ai.ts                                    (EDIT — add fetchDpi)
  packages/types/src/ai.ts                                          (EDIT — add DPI types)
  apps/web/src/app/matches/[id]/page.tsx                            (EDIT — add Compatibility tab link)

DO NOT touch:
  apps/api/, apps/ai-service/
  Other web pages, components

────────────────────────────────────────────────────────────────────
STEP 1: Types in packages/types/src/ai.ts

export interface DpiFactorContribution {
  factor: string
  contribution: number
  direction: 'protective' | 'concern' | 'neutral'
}

export interface DpiResponse {
  score: number  // 0..1
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  label: string
  narrative: string
  suggestion: string
  top_factors: DpiFactorContribution[]
  disclaimer: string
  fallback?: boolean
}

────────────────────────────────────────────────────────────────────
STEP 2: Server action in apps/web/src/app/actions/ai.ts

'use server'
export async function fetchDpi(matchId: string): Promise<DpiResponse | null> {
  // Same cookie auth pattern as fetchCoachSuggestions and fetchEmotionalScore
  // GET /api/v1/ai/divorce-indicator/:matchId
  // On error → return null (UI shows error state)
}

────────────────────────────────────────────────────────────────────
STEP 3: Compatibility Page (apps/web/src/app/matches/[id]/compatibility/page.tsx)

Server component. Layout:

  <CompatibilityDisclaimer />  // ALWAYS first, ABOVE everything else
  
  <h1 className="font-['Playfair_Display'] text-[#7B2D42] text-2xl">
    Compatibility Analysis
  </h1>
  
  <p className="text-[#6B6B76] text-sm mt-2">
    A thoughtful look at your match based on profile patterns.
    Use as one input among many.
  </p>

  <Suspense fallback={<GaugeSkeleton />}>
    <CompatibilityGaugeClient matchId={params.id} />
  </Suspense>

────────────────────────────────────────────────────────────────────
STEP 4: CompatibilityDisclaimer (apps/web/src/components/dpi/CompatibilityDisclaimer.tsx)

Server component. Always rendered.

<div className="bg-[#FEFAF6] border border-[#C5A47E]/30 rounded-xl p-4 mb-6">
  <p className="text-sm text-[#2E2E38] leading-relaxed">
    <span className="font-semibold text-[#7B2D42]">A note before reading:</span>{' '}
    This analysis reflects compatibility patterns from comparable profiles. 
    Every relationship is unique, and the people in it know themselves best. 
    Use this as one perspective among many — not as a verdict.
  </p>
</div>

────────────────────────────────────────────────────────────────────
STEP 5: CompatibilityGauge.client.tsx

Client component. Fetches DPI on mount. Three states:

LOADING: skeleton with "Analyzing compatibility patterns..."

ERROR / FALLBACK: 
  Show fallback notice: "We couldn't generate detailed analysis right now. 
  Please try again in a moment."
  Don't show empty gauge.

SUCCESS:
  Render gauge + narrative.

Gauge uses semicircle SVG arc (180°):
  Score 0.0 → 0.30 → arc fills with Sage #7FA682
  Score 0.30 → 0.55 → arc fills with Warm Gold #C5A47E  
  Score 0.55 → 1.0 → arc fills with Burgundy #7B2D42

Center of gauge: large label text (Playfair Display), e.g. "Strong Foundation"
Below gauge: narrative text in Inter, max-width prose-sm
Below narrative: suggestion in italic Inter, "💬 Try discussing: {suggestion}"

NEVER show:
- The raw 0.34 / 67% number anywhere
- Words "divorce" / "fail" / "risk" 
- Numerical breakdown in the gauge

────────────────────────────────────────────────────────────────────
STEP 6: FactorBreakdown.client.tsx

Hidden by default behind <details> element:

<details className="mt-6 border-t border-[#C5A47E]/20 pt-4">
  <summary className="text-sm text-[#0E7C7B] cursor-pointer hover:underline">
    See what shaped this analysis
  </summary>
  
  <div className="mt-4 space-y-3">
    {top_factors.map(factor => (
      <FactorCard 
        key={factor.factor}
        factor={factor}
        translation={translateFactorName(factor.factor)}
      />
    ))}
  </div>
</details>

translateFactorName: 
  'family_values_alignment' → 'Family priorities'
  'income_disparity_pct' → 'Financial expectations'  
  'age_gap_years' → 'Age difference'
  'lifestyle_compatibility' → 'Daily life preferences'
  ... etc — never use technical names

FactorCard format:
  Direction icon + factor name + 1-line context
  Protective (green ✓): "Family priorities — strong alignment"  
  Concern (gold ⚠): "Financial expectations — worth discussing openly"
  Neutral (—): "Age difference — moderate gap"

────────────────────────────────────────────────────────────────────
STEP 7: Match detail page link

In apps/web/src/app/matches/[id]/page.tsx, add a tab/link to the new Compatibility page.

Style: subtle, not promotional. Burgundy text on hover, no colorful badge:
  <Link href={`/matches/${id}/compatibility`} 
        className="text-sm text-[#0E7C7B] hover:text-[#149998] underline">
    View compatibility analysis →
  </Link>

This single link is the ONLY entry point to DPI. Don't surface it in match cards, feed, or anywhere else.

────────────────────────────────────────────────────────────────────
VERIFICATION:
- pnpm --filter @smartshaadi/web type-check    # 0 errors
- pnpm --filter @smartshaadi/web lint          # 0 NEW warnings
- pnpm test                                    # all baselines hold
- Browser: navigate to /matches/<id>/compatibility, verify gauge renders
- Mobile 375px: gauge fits, disclaimer readable, factor breakdown collapses cleanly

When done:
- Delete .ai-python-dpi-done and .api-node-dpi-done
- Commit: "feat(web): DPI Compatibility Analysis page + gauge + factor breakdown"
- Reply: "Step 1 (DPI) complete — ready for git push and Railway verify"
```

---

## Production Deploy

```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git log --oneline -8
```

Push from PowerShell:

```powershell
cd "D:\Do Not Open\vivah\vivahOS"
git push origin main
```

Railway redeploys both services. ai-service redeploy includes:
- New DPI router + Opus integration
- Synthetic data generation on first model load (~15s)

Monitor:
- Railway → vivah → Deployments — watch for ✅
- Railway → ai-service → Deployments — watch for ✅

---

## Verification Checklist

```
[ ] Phase 0: pytest 105+10 = 115 passing, model.pkl generated
[ ] ai-python-dpi: 12+ tests pass
[ ] api-node-dpi: 10+ new tests, 533+ total
[ ] Frontend type-check 0, lint clean
[ ] /health: models.dpi: "sklearn_loaded"
[ ] POST /ai/dpi/compute returns realistic prediction (mock or live LLM)
[ ] GET /api/v1/ai/divorce-indicator/:matchId — 401 unauth, 403 non-participant, 404 non-accepted match
[ ] Browser: /matches/<id>/compatibility renders disclaimer ABOVE gauge
[ ] Gauge uses Sage/Gold/Burgundy palette (NOT red/yellow/green)
[ ] Narrative renders, no forbidden words ("fail", "risk", "doomed")
[ ] Factor breakdown collapsed by default
[ ] Mobile 375px: layout intact
[ ] Privacy: log into account A, view DPI for match with B; log into B, verify B's view of same match returns DIFFERENT computation (B's preferences, not A's)
[ ] Rate limit: 6th DPI request in 24h returns 429
[ ] USE_MOCK_SERVICES=true: returns mock narratives, never calls Opus
[ ] Production smoke after deploy: privacy verified end-to-end
```

---

## Known Risks To Watch For

1. **Opus 4.7 generates a forbidden word despite prompt** — mitigation: post-generation check for keyword blacklist in `dpi_service.py`, fall back to mock if matched
2. **Synthetic model gives unrealistic scores on real production profiles** — mitigation: clamp scores, log score distribution, plan retraining when 500+ real DPI requests accumulated
3. **Privacy bug: requester accidentally sees match's view** — mitigation: cache key includes userId not just matchId; multiple test cases verify this; manual privacy test in checklist
4. **Disclaimer bypassed via direct API call** — disclaimer is in API response, not just UI. Even raw API consumers see it.
5. **User screenshot shares DPI with their match** — out of scope, but UX copy should encourage thoughtful internal use

---

## What's Next

After Week 11 Step 1 (DPI) ships:

**Week 11 Step 2 — Family Inclination Index (FII)**
- Rule-based + Sonnet narrative
- Visible to BOTH parties (unlike DPI)
- Surfaced in match cards as a soft compatibility hint
- Much simpler scope (~1 day total)
