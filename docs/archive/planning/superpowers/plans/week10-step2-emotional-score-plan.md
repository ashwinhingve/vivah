# Week 10 · Step 2 — Emotional Score
## Smart Shaadi · Phase 3 Implementation Plan

**Baseline:** Week 10 Step 1 shipped to production · ai-service Online · Coach live with mock suggestions · 518/518 + 91/91 tests passing
**Goal:** Emotional Score badge live in chat header (Teal/Gold/Burgundy based on conversation health)
**Agent strategy:** 2-teammate parallel build (Python + Node) → single agent for frontend
**Estimated output:** ~10 new pytest tests + ~5 new Vitest tests · Badge rendering in chat UI

---

## What's Different From Step 1

| Aspect | Step 1 (Coach) | Step 2 (Emotional Score) |
|--------|----------------|--------------------------|
| LLM dependency | Yes — Sonnet 4.6 | **No** — pure ML inference |
| API cost | Per-call to Anthropic | **Zero** at runtime |
| Latency | 1.5–2.5s (Sonnet) | <100ms (local model) |
| Privacy surface | Reads chat history | Reads chat history (same scope) |
| Auth surface | Per-request (chat) | Per-request + daily Bull job |
| Cache layer | Redis 1h TTL, invalidate on new message | Redis 25h TTL, refresh nightly |
| Real-time | Yes (user-triggered) | No (computed nightly + on-demand) |

The Coach is realtime and LLM-driven. Emotional Score is a deterministic calculation that runs daily on every active match and can be requested ad-hoc by the chat UI.

---

## Pre-Flight Checklist

```bash
# 1. Baseline still holds
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm test
# Expect: 518/518 api · 91/91 schemas · 7/7 types

# 2. ai-service local boots
cd apps/ai-service && ai-venv
uvicorn src.main:app --port 8000 &
sleep 4 && curl -s http://localhost:8000/health | python3 -m json.tool
kill %1
# Expect: phase: 3, models.coach: "llm_sonnet", models.emotional: "pending_..."

# 3. Production health
curl -s https://api.smartshaadi.co.in/health
# Expect: 200 OK
```

If any fails → fix before proceeding.

---

## Research Notes — Decisions Locked Upfront

### Decision 1: Model Choice — `cardiffnlp/twitter-xlm-roberta-base-sentiment`

This is the model in the original plan, and it's the right choice. Reasons:

- **Multilingual** — handles Hindi, Hinglish, English natively. Other sentiment models are English-only.
- **Twitter-trained** — short conversational text matches chat domain better than formal-text-trained models
- **3-class output** — POSITIVE / NEUTRAL / NEGATIVE with confidence scores
- **~1GB memory footprint** — fits comfortably on Railway's 8GB plan

Alternative considered: `nlptown/bert-base-multilingual-uncased-sentiment` (5-star rating model) — but 5 classes are noisier than 3 for our use case.

Loaded once at ai-service startup, reused across requests. No per-request loading cost.

### Decision 2: Score Composition — 4 sub-scores, weighted

| Sub-score | Weight | What it measures |
|-----------|--------|------------------|
| **Sentiment** | 30% | HuggingFace POSITIVE probability avg over last 20 messages |
| **Enthusiasm** | 25% | Response time pattern — faster replies = more interested |
| **Engagement** | 25% | Message length trend — increasing = deepening conversation |
| **Curiosity** | 20% | Question-asking ratio — more questions = more interest |

Combined: `score = 0.30*sentiment + 0.25*enthusiasm + 0.25*engagement + 0.20*curiosity`

Output: integer 0–100, plus `trend` field comparing to 7-day rolling average.

### Decision 3: Trend Detection

Compute `delta = current_score - 7day_avg`:
- `delta > +5` → `'improving'`
- `delta < -5` → `'declining'`
- otherwise → `'stable'`

Trend is what users actually care about. A score of 65 alone means little. "65, declining from 75 last week" is a real signal.

### Decision 4: Badge UX — Label-only, never raw number

Showing "Emotional Score: 47" sounds clinical and judgemental. Users hate being measured.

Instead show a colored pill with a friendly label:
- Score ≥ 70 → Teal `#0E7C7B` "Warm" badge
- Score 40–69 → Gold `#C5A47E` "Steady" badge
- Score < 40 → Burgundy `#7B2D42` "Cooling" badge

Trend arrow next to label: ↑ improving, ↓ declining, → stable.

Hover tooltip shows the 4-factor breakdown in plain English ("Conversation tone: warm · Reply speed: medium · Replies getting longer · 30% of messages are questions"). NEVER show raw 0–100 numbers anywhere in UI.

### Decision 5: When to Compute

Two paths:

**Daily Bull job (apps/api/src/jobs/emotionalScoreJob.ts):**
- Runs at 2am IST (off-peak)
- Fetches all match pairs with messages in last 30 days
- Calls ai-service for each → stores in Redis with 25h TTL
- Total runtime: ~30s for 1000 matches

**On-demand from chat UI:**
- User opens a chat → frontend reads `Redis: "emotional:{matchId}"`
- If hit → render badge instantly
- If miss (new match, never computed) → trigger sync compute, render in <500ms

This means the badge is always "free" to render (Redis hit) for active conversations. Only the first view of a brand-new conversation pays the inference cost.

### Decision 6: Privacy — Same scope as Coach

The Emotional Score is computed from messages you can already read. No new privacy surface — same participant-only access. But:
- ✅ Both participants can see their own match's badge (same value, both views)
- ✅ NEVER expose to non-participants
- ❌ NEVER include in match feed / discovery (would be creepy)
- ❌ NEVER use as a matching signal (different feature, different consent surface)

Score is informational for both people in the conversation, period.

### Decision 7: Edge Cases

| Scenario | Score | Why |
|----------|-------|-----|
| 0 messages exchanged | `50, 'stable'` | Neutral default — no data to judge |
| < 5 messages | `50, 'stable'` | Not enough signal for meaningful score |
| One side hasn't replied in 14+ days | `score - 20, 'declining'` | Strong negative signal |
| Both sides chatted heavily, recently | High score, likely `improving` | Healthy conversation |
| Ambiguous (mixed sentiment, varied response times) | Around 50, `'stable'` | Honest about uncertainty |

Edge cases tested explicitly in pytest.

### Decision 8: Agent Team Split

| Teammate | Domain | Files Owned |
|----------|--------|-------------|
| `ai-python-emotional` | apps/ai-service/ | `routers/emotional.py`, `services/emotional_service.py`, `services/sentiment_model.py`, `schemas/emotional.py`, `tests/test_emotional.py` |
| `api-node-emotional` | apps/api/ | `routes/ai.ts` (add emotional endpoints), `services/aiService.ts` (add emotional functions), `jobs/emotionalScoreJob.ts` (new), `__tests__/ai.emotional.test.ts` |

Single agent (after both done): Frontend badge in chat header.

---

## Phase 0 — Single Agent: HuggingFace Model Setup

*~10 minutes. Must complete before teammates spawn.*

```
TASK: Add HuggingFace transformers to ai-service dependencies and verify the
sentiment model loads correctly.

Scope:
1. Verify transformers and torch are already in apps/ai-service/pyproject.toml.
   They should be (used by Phase 0 health check signature). If not, add:
     transformers>=4.46.0
     torch>=2.5.0

2. Create apps/ai-service/src/services/sentiment_model.py:
   - Module-level singleton loaded once at first call
   - Function: load_sentiment_pipeline() → returns HuggingFace pipeline
   - Model: cardiffnlp/twitter-xlm-roberta-base-sentiment
   - Use device="cpu" (no GPU on Railway)
   - Cache the pipeline in a module-level variable for reuse
   - On import failure → log error, return None (allow startup to continue)

3. Update health check in src/main.py:
   - models.emotional → "huggingface_loaded" if sentiment pipeline loaded
   - models.emotional → "huggingface_unavailable" if not loaded
   - Health endpoint must NEVER fail because of this — degrade gracefully

4. Run: pytest tests/ -v
   All 91 existing tests must still pass.

5. Verify model downloads on first call:
   python -c "from src.services.sentiment_model import load_sentiment_pipeline; pipe = load_sentiment_pipeline(); print(pipe('I am very happy today'))"
   Expected output: [{'label': 'positive', 'score': 0.98...}]
   
   Note: First call downloads ~1GB of model weights. Allow 2-5 min.
   Subsequent calls use cached weights from ~/.cache/huggingface/

6. Commit: "chore(ai-service): add HuggingFace sentiment model loader"

No plan approval needed. Implement directly.
```

---

## Phase 1A — Agent Teammate: `ai-python-emotional`

```
You are teammate ai-python-emotional. You own the Python ai-service work for
Emotional Score.

FILES YOU OWN — touch nothing outside this list:
  apps/ai-service/src/routers/emotional.py            (CREATE)
  apps/ai-service/src/services/emotional_service.py   (CREATE)
  apps/ai-service/src/schemas/emotional.py            (CREATE)
  apps/ai-service/tests/test_emotional.py             (CREATE)
  apps/ai-service/src/main.py                         (EDIT — register router only)

DO NOT TOUCH:
  apps/api/, apps/web/, packages/, prompts/
  routers/coach.py, routers/horoscope.py, services/sentiment_model.py (Phase 0 owns it)

────────────────────────────────────────────────────────────────────
STEP 1: Schemas (apps/ai-service/src/schemas/emotional.py)

from pydantic import BaseModel, Field
from typing import Literal

class EmotionalMessage(BaseModel):
    sender: Literal["A", "B"]
    text: str
    timestamp: str  # ISO format

class EmotionalScoreRequest(BaseModel):
    match_id: str
    messages: list[EmotionalMessage] = Field(default_factory=list)
    historical_avg: float | None = Field(default=None, description="7-day rolling avg, optional")

class EmotionalBreakdown(BaseModel):
    sentiment: int       # 0-100
    enthusiasm: int      # 0-100
    engagement: int      # 0-100
    curiosity: int       # 0-100

class EmotionalScoreResponse(BaseModel):
    score: int                                          # 0-100, weighted combined
    label: Literal["WARM", "STEADY", "COOLING"]
    trend: Literal["improving", "stable", "declining"]
    breakdown: EmotionalBreakdown
    last_updated: str                                   # ISO timestamp

────────────────────────────────────────────────────────────────────
STEP 2: Service Logic (apps/ai-service/src/services/emotional_service.py)

Implement these functions. ALL must handle empty/short message lists gracefully.

def compute_sentiment_score(messages: list[Message], pipeline) -> int:
    """
    Run last 20 messages through HuggingFace pipeline.
    Sum (positive_score - negative_score) for each message → average.
    Map [-1.0, 1.0] range to [0, 100] linearly.
    Empty messages → return 50 (neutral baseline).
    pipeline=None (model failed to load) → return 50.
    """

def compute_enthusiasm_score(messages: list[Message]) -> int:
    """
    For each message except the first, compute time gap to previous message.
    Average gap in minutes.
    Map: 0-30min → 90, 30-120min → 60, 120-720min (12h) → 40, 720+ → 20.
    Single message or empty → return 50.
    """

def compute_engagement_score(messages: list[Message]) -> int:
    """
    Compare avg message length of last 10 vs previous 10.
    Increasing length → engagement going up.
    Compute: (recent_avg - older_avg) / older_avg * 100, clamp to [-50, +50], shift to [0, 100].
    Empty or all messages from one sender → return 50.
    Less than 5 messages → return 50.
    """

def compute_curiosity_score(messages: list[Message]) -> int:
    """
    Count question marks across all messages.
    questions_per_message = total_question_marks / total_messages
    Map: > 0.4 → 90, 0.2-0.4 → 70, 0.1-0.2 → 50, < 0.1 → 30.
    Empty messages → return 50.
    """

def compute_combined_score(breakdown: EmotionalBreakdown) -> int:
    """
    Weighted: 0.30*sentiment + 0.25*enthusiasm + 0.25*engagement + 0.20*curiosity
    Round to int 0-100.
    """

def determine_label(score: int) -> str:
    """
    score >= 70 → "WARM"
    40 <= score < 70 → "STEADY"
    score < 40 → "COOLING"
    """

def determine_trend(current: int, historical_avg: float | None) -> str:
    """
    historical_avg=None → "stable" (first time computing)
    delta = current - historical_avg
    delta > +5 → "improving"
    delta < -5 → "declining"
    else → "stable"
    """

async def compute_emotional_score(
    request: EmotionalScoreRequest,
    pipeline
) -> EmotionalScoreResponse:
    """
    Edge case shortcut: len(messages) < 5 → return score=50, label="STEADY", trend="stable"
    Otherwise: compute all 4 sub-scores → combine → label → trend → return response.
    Always include current ISO timestamp in last_updated.
    """

────────────────────────────────────────────────────────────────────
STEP 3: Router (apps/ai-service/src/routers/emotional.py)

POST /ai/emotional/score
Request body: EmotionalScoreRequest
Response: EmotionalScoreResponse
Auth: verify_internal_key (same as horoscope/coach)

Import sentiment pipeline from src.services.sentiment_model.load_sentiment_pipeline()
Pass to compute_emotional_score() — let it handle None gracefully.

Register router in src/main.py: app.include_router(emotional_router)

────────────────────────────────────────────────────────────────────
STEP 4: Tests (apps/ai-service/tests/test_emotional.py)

Mock the HuggingFace pipeline (don't load real model in tests — slow + flaky).
Use pytest fixtures and unittest.mock.

Minimum 10 tests covering:
1. test_empty_messages_returns_neutral_steady
2. test_few_messages_under_5_returns_neutral
3. test_sentiment_positive_scores_high
4. test_sentiment_negative_scores_low
5. test_enthusiasm_fast_replies_high_score
6. test_enthusiasm_slow_replies_low_score
7. test_engagement_increasing_length_high
8. test_engagement_decreasing_length_low
9. test_curiosity_many_questions_high
10. test_combined_score_label_thresholds (3 boundary cases: 39/40, 69/70)
11. test_trend_improving (current > avg by 6+)
12. test_trend_declining (current < avg by 6+)
13. test_trend_stable_when_no_historical
14. test_pipeline_none_falls_back_to_neutral_sentiment

────────────────────────────────────────────────────────────────────
VERIFICATION (must run before signaling done):
  cd apps/ai-service && source ~/venvs/smart-shaadi-ai/bin/activate
  pytest tests/test_emotional.py -v
  pytest tests/ -v   # All tests, must be 91 + new emotional tests

When done:
  Create file .ai-python-emotional-done at repo root
  Commit: "feat(ai-service): Emotional Score router + service + tests"
  Reply: "ai-python-emotional done — N tests, commit hash"

NO plan approval mode (WSL idle deaths). Implement directly.
```

---

## Phase 1B — Agent Teammate: `api-node-emotional`

```
You are teammate api-node-emotional. You own the Node.js API work for Emotional Score.

FILES YOU OWN — touch nothing outside this list:
  apps/api/src/routes/ai.ts                            (EDIT — add emotional routes)
  apps/api/src/services/aiService.ts                   (EDIT — add emotional functions)
  apps/api/src/jobs/emotionalScoreJob.ts               (CREATE)
  apps/api/src/__tests__/ai.emotional.test.ts          (CREATE)

DO NOT TOUCH:
  apps/ai-service/, apps/web/, packages/
  Existing coach routes (only ADD new emotional routes)
  Socket.io handlers

────────────────────────────────────────────────────────────────────
STEP 1: Service client (aiService.ts)

Add: getEmotionalScore(matchId: string, messages: ChatMessage[]): Promise<EmotionalScoreResponse>

POST to ${AI_SERVICE_URL}/ai/emotional/score with:
- X-Internal-Key auth header
- 8s AbortSignal timeout (model inference is fast)

Types (add to local file or packages/types/src/ai.ts):
  interface EmotionalBreakdown {
    sentiment: number; enthusiasm: number; engagement: number; curiosity: number;
  }
  interface EmotionalScoreResponse {
    score: number;
    label: 'WARM' | 'STEADY' | 'COOLING';
    trend: 'improving' | 'stable' | 'declining';
    breakdown: EmotionalBreakdown;
    last_updated: string;
  }

────────────────────────────────────────────────────────────────────
STEP 2: Express route (routes/ai.ts)

GET /api/v1/ai/emotional-score/:matchId
Auth: requireSession (same pattern as coach)
Rate limit: 60 req/user/hour (Redis INCR + EXPIRE — frequent reads OK, just not abuse)

Handler:
1. Resolve userId → profileId via packages/db
2. Verify match participation (same pattern as coach):
   const match = db.select().from(matchRequests).where(...)
   if (!match || (match.requesterId !== profileId && match.receiverId !== profileId))
     return 403
3. Try Redis cache first: GET emotional:{matchId}
   If hit AND less than 24h old → return cached response
4. Cache miss or stale:
   Fetch last 20 messages from internal endpoint (same as coach)
   Fetch historical_avg from Redis: GET emotional:{matchId}:7day_avg (may be null)
   Call aiService.getEmotionalScore(matchId, messages)
5. Cache result:
   SET emotional:{matchId} → JSON, EX 86400 (24h)
   Update 7-day rolling avg via SADD with timestamp, trim members older than 7d
6. Return: { success: true, data: emotionalResponse, cached: false }
7. On AI service unreachable → return graceful fallback:
   { success: true, data: { score: 50, label: 'STEADY', trend: 'stable', breakdown: {...50s}, last_updated: now }, fallback: true }

────────────────────────────────────────────────────────────────────
STEP 3: Bull job (jobs/emotionalScoreJob.ts)

Schedule via existing Bull infrastructure: cron daily at "0 21 * * *" UTC (2am IST).
Job processor:
1. Query PostgreSQL for all matches with status='ACCEPTED' that have any chat messages in last 30 days
2. For each match (with concurrency limit of 5 to avoid overwhelming ai-service):
   - Fetch last 20 messages from MongoDB
   - Call aiService.getEmotionalScore()
   - Write to Redis with 25h TTL
   - Update 7-day rolling avg
3. Log summary: "Processed N matches in Mms"

Register job at app startup (apps/api/src/index.ts or wherever queue init happens).
Use existing BullMQ queue pattern from notifications/payment jobs — don't create new queue infra.

────────────────────────────────────────────────────────────────────
STEP 4: Tests (apps/api/src/__tests__/ai.emotional.test.ts)

Minimum 5 tests:
1. GET emotional-score without session → 401
2. GET emotional-score for match user is not participant → 403
3. GET emotional-score with valid auth → 200 with expected shape (mock aiService)
4. GET emotional-score returns cached value when Redis has fresh entry
5. GET emotional-score returns fallback (label STEADY, trend stable) when ai-service errors

Use existing test utilities (auth fixtures, mock Redis, mock aiService) from ai.coach.test.ts — copy patterns, don't reinvent.

────────────────────────────────────────────────────────────────────
VERIFICATION:
  pnpm --filter @smartshaadi/api type-check  # 0 errors
  pnpm --filter @smartshaadi/api lint        # 0 errors
  pnpm --filter @smartshaadi/api test        # 518 baseline + 5 new = 523

When done:
  Create file .api-node-emotional-done at repo root
  Commit: "feat(api): Emotional Score endpoint + Bull job + tests"
  Reply: "api-node-emotional done — N tests, commit hash"

NO plan approval mode. Implement directly.
```

---

## Phase 2 — Single Agent: Frontend Badge

```
Both Phase 1 teammates done. Verify backend before building UI.

Smoke tests first:

# 1. ai-service direct
curl -X POST http://localhost:8000/ai/emotional/score \
  -H "X-Internal-Key: dev-internal-key-change-in-prod" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"test1","messages":[{"sender":"A","text":"How are you?","timestamp":"2026-05-05T10:00:00Z"},{"sender":"B","text":"Great! How was your day?","timestamp":"2026-05-05T10:05:00Z"},{"sender":"A","text":"Wonderful actually!","timestamp":"2026-05-05T10:10:00Z"},{"sender":"B","text":"That makes me happy. What did you do?","timestamp":"2026-05-05T10:15:00Z"},{"sender":"A","text":"Went hiking in the morning.","timestamp":"2026-05-05T10:20:00Z"}],"historical_avg":null}'
# Expect: { score: ~70+, label: "WARM", trend: "stable", breakdown: {...}, last_updated: "..." }

# 2. Node API proxy
curl -X GET http://localhost:4000/api/v1/ai/emotional-score/<test-match-id> \
  -H "Cookie: better-auth.session_token=..."
# Expect: { success: true, data: { score, label, trend, breakdown, last_updated } }

If both pass → build frontend.

────────────────────────────────────────────────────────────────────
FILES IN SCOPE:
  apps/web/src/components/chat/EmotionalScoreBadge.client.tsx     (CREATE)
  apps/web/src/app/actions/ai.ts                                  (EDIT — add fetchEmotionalScore)
  apps/web/src/app/chat/[matchId]/page.tsx                        (EDIT — add badge to header)
  packages/types/src/ai.ts                                        (EDIT — add emotional types)

DO NOT touch any other files.

────────────────────────────────────────────────────────────────────
STEP 1: Types (packages/types/src/ai.ts)

Add:
  export interface EmotionalBreakdown { sentiment: number; enthusiasm: number; engagement: number; curiosity: number }
  export interface EmotionalScore {
    score: number;
    label: 'WARM' | 'STEADY' | 'COOLING';
    trend: 'improving' | 'stable' | 'declining';
    breakdown: EmotionalBreakdown;
    last_updated: string;
    fallback?: boolean;
  }

────────────────────────────────────────────────────────────────────
STEP 2: Server Action (apps/web/src/app/actions/ai.ts)

Add to existing file:

'use server'
export async function fetchEmotionalScore(matchId: string): Promise<EmotionalScore | null> {
  const cookies = await getAuthCookies()  // existing helper
  try {
    const res = await fetch(`${API_URL}/api/v1/ai/emotional-score/${matchId}`, {
      headers: { 'Cookie': cookieHeader(cookies) },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

────────────────────────────────────────────────────────────────────
STEP 3: Component (apps/web/src/components/chat/EmotionalScoreBadge.client.tsx)

Props: { matchId: string }

State:
  score: EmotionalScore | null = null
  loading: boolean = true

On mount: call fetchEmotionalScore(matchId) → setScore.

Render logic:
  - loading || score === null || score.score === 50 (default) → render NOTHING (no badge for new conversations or errors)
  - Otherwise → render pill badge with label + trend arrow

Color & label mapping:
  WARM (>= 70):    bg-[#0E7C7B]/15 text-[#0E7C7B] border-[#0E7C7B]/30 → "Warm"
  STEADY (40-69):  bg-[#C5A47E]/15 text-[#C5A47E] border-[#C5A47E]/40 → "Steady"
  COOLING (< 40):  bg-[#7B2D42]/15 text-[#7B2D42] border-[#7B2D42]/30 → "Cooling"

Trend arrow: 
  improving → ↑
  declining → ↓
  stable → → (or omit, less visual noise)

Tooltip on hover (use existing Radix Tooltip or implement simple title attr):
  "Conversation tone: {sentimentLabel}
   Reply pace: {enthusiasmLabel}
   Message depth: {engagementLabel}
   Questions asked: {curiosityLabel}"
  
  Helper functions to convert 0-100 sub-scores to labels:
  sentimentLabel: > 70 = "warm" / 40-70 = "neutral" / < 40 = "cool"
  enthusiasmLabel: > 70 = "fast" / 40-70 = "moderate" / < 40 = "slow"
  engagementLabel: > 70 = "deepening" / 40-70 = "consistent" / < 40 = "thinning"
  curiosityLabel: > 70 = "highly curious" / 40-70 = "balanced" / < 40 = "low"

NEVER show raw numeric score. NEVER show breakdown numerics. Labels only.

Sizing:
  Badge: h-7 px-3 rounded-full text-xs font-medium border flex items-center gap-1
  Mobile (375px): text-[10px] h-6 px-2

────────────────────────────────────────────────────────────────────
STEP 4: Chat Page (apps/web/src/app/chat/[matchId]/page.tsx)

Find existing chat header (where 💡 Coach button lives).
Add <EmotionalScoreBadge matchId={matchId} /> to the right of the match name, left of the action buttons.

Layout in header:
  [Match Avatar] [Match Name] [EmotionalScoreBadge] ... [💡 button] [Video button] [Menu]

────────────────────────────────────────────────────────────────────
VERIFICATION:
  pnpm --filter @smartshaadi/web type-check     # 0 errors
  pnpm --filter @smartshaadi/web lint           # 0 NEW warnings
  pnpm test                                     # All baselines hold
  
  Manual smoke (do not run, describe in commit message):
  1. Open chat for accepted match
  2. See badge in header (or nothing for new match with <5 messages)
  3. Hover badge → tooltip shows 4-factor breakdown in plain English
  4. Mobile 375px: badge visible, doesn't overflow header

When done:
  Delete .ai-python-emotional-done and .api-node-emotional-done
  Commit: "feat(web): Emotional Score badge in chat header"
  Reply: "Step 2 complete — ready for git push and Railway verify"
```

---

## Production Deploy

After all 3 phases commit locally:

```bash
# From WSL
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
git log --oneline -5    # verify commits

# Push from PowerShell (WSL has no git creds)
```

```powershell
cd "D:\Do Not Open\vivah\vivahOS"
git push origin main
```

Railway auto-deploys both services. Monitor:
- ai-service redeploy includes new HuggingFace model download (first deploy ~5 min, subsequent <1 min thanks to layer caching)
- vivah api redeploy is fast (~30s)

After deploy, badge appears for any accepted match with 5+ messages.

---

## Verification Checklist

```
[ ] Phase 0: pytest 91/91 + transformers loads model
[ ] ai-python-emotional: 10+ new tests pass
[ ] api-node-emotional: 5+ new tests, baseline 518 holds
[ ] Frontend type-check 0, lint 0 new
[ ] ai-service /health returns models.emotional: "huggingface_loaded"
[ ] POST /ai/emotional/score with valid auth + 5+ messages → returns realistic score
[ ] GET /api/v1/ai/emotional-score/:matchId — auth enforced, 403 for non-participants
[ ] Badge renders in chat header for accepted match with 5+ messages
[ ] Badge hidden for matches with <5 messages
[ ] Tooltip shows 4-factor breakdown in plain English (no raw numbers)
[ ] Mobile 375px viewport: badge fits header without overflow
[ ] USE_MOCK_SERVICES=true → ai-service still returns valid scores (not LLM-dependent, so this works without Anthropic key)
[ ] Bull job registered, schedulable, runs without errors when invoked manually
[ ] Production smoke test (after deploy): badge visible in real chat
```

---

## What's Next

Week 10 Step 2 complete → Week 11 Step 1: **Divorce Probability Indicator** (DPI)

DPI is the most privacy-sensitive feature in Phase 3:
- Private to requester only (not visible to match)
- 10-factor sklearn logistic regression
- Synthetic training data initially
- High-stakes UX (can cause anxiety) — requires careful tooltip and disclaimer copy
- Uses Opus 4.7 for the narrative explanation (high-quality reasoning > speed)

Estimated: 2 days Python (model training + inference) + 1 day Node (privacy enforcement) + 1 day frontend (gauge UI + disclaimer).
