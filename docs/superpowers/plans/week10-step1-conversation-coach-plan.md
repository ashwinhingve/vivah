# Week 10 · Step 1 — AI Service Deploy + Conversation Coach
## Smart Shaadi · Phase 3 Implementation Plan

**Baseline:** 511/511 tests passing · P0 fixes committed (2d3d7d9) · Phase 3 unblocked  
**Goal:** AI service verified live on Railway + Conversation Coach end-to-end  
**Agent strategy:** 2-teammate parallel build (Python + Node.js) → single agent for frontend  
**Estimated output:** ~8 new pytest tests + ~4 new Vitest/API tests · Coach live in chat UI

---

## Pre-Flight Checklist (Run Before Spawning Any Agent)

Verify these in your terminal before writing a single line of Phase 3 code.

```bash
# 1. Confirm baseline still holds
pnpm test && pnpm type-check && pnpm lint
# Expect: 511/511 · 0 errors · 0 warnings

# 2. Confirm ai-service boots locally
cd apps/ai-service
source venv/bin/activate   # or: python -m venv venv && pip install -e ".[dev]"
uvicorn src.main:app --port 8000 --reload
curl http://localhost:8000/health
# Expect: { "status": "ok" } — if 404, main.py needs the /health route added

# 3. Confirm Railway ai-service deployment status
# Open Railway dashboard → smartshaadi project → ai-service service
# Check: last deploy succeeded · /health returns 200
# If not deployed: the plan below handles it

# 4. Confirm env vars exist (check .env files, NOT Railway dashboard yet)
grep -E "AI_SERVICE_URL|AI_SERVICE_API_KEY|HELICONE_API_KEY|ANTHROPIC_API_KEY" apps/api/.env
grep -E "AI_SERVICE_URL|AI_SERVICE_API_KEY" apps/ai-service/.env
# Missing keys → add to .env.example + Railway env before proceeding
```

---

## Research Notes — Decisions Made Upfront

### Why these decisions are locked before coding starts

Changing architecture mid-build in agent teams causes file ownership conflicts.
Everything below is a pre-decision that agents implement, not discover.

---

### Decision 1: Claude Model — `claude-sonnet-4-6` ✅

Quality > cost. Suggestions feed directly into a user's first impression of their match —
robotic or culturally off output erodes trust irreversibly. Sonnet 4.6 gives near-Opus
reasoning with realtime-acceptable latency.

| Model | Latency p99 | Use for |
|-------|-------------|---------|
| `claude-opus-4-7` | ~4–6s | Divorce Probability narrative, Family Index reasoning, complex analysis features (Week 11+) |
| `claude-sonnet-4-6` | ~1.5–2.5s | **Conversation Coach** — latency-acceptable in chat UX, excellent cultural nuance |
| `claude-haiku-4-5` | <1s | Not used in Phase 3 — quality bar too high |

**Note on billing:** Your Max plan covers your Claude Code dev workflow.
Production API calls from ai-service → Anthropic API bill separately at API rates.
Helicone caching helps (same {profileA, profileB, history_hash} input returns cached output
without an API charge), and the Redis cache layer above Helicone catches most repeats.
At early Phase 3 traffic this is negligible — flag for review at 1k+ DAU.

---

### Decision 2: Prompt Architecture — Structured XML Output

The coach prompt must return parseable output, not prose. Sonnet 4.6 handles JSON well,
but XML tags are still preferred here because:
- Self-closing on truncation (LLM hits max_tokens mid-suggestion → fewer parse errors)
- More forgiving with embedded quotes, apostrophes, Devanagari text (Hindi/Hinglish chips)
- Trivially parseable with `re.findall` — no JSON parsing exception handling needed

```
<suggestions>
  <suggestion>
    <text>Aap dono ko trekking pasand hai — last trip ka koi memorable moment share kiya?</text>
    <reason>Shared outdoor interest, invites storytelling</reason>
    <tone>curious</tone>
  </suggestion>
  ...
</suggestions>
```

Prompt file: `prompts/conversation-coach-v1.md` (versioned — never edit in place).

---

### Decision 3: Conversation State Detection

Three states drive which type of suggestion is generated:

| State | Detection Rule | Suggestion Type |
|-------|---------------|-----------------|
| `STARTING` | total_messages < 6 OR last_message is None | Ice-breakers, low-stakes questions |
| `ACTIVE` | messages > 6 AND avg_gap_hours < 24 | Deepening questions, shared interests |
| `COOLING` | last_message_age_hours > 48 OR avg_response_rate declining | Re-engagement openers, topic pivots |

State computed server-side in `coach_service.py` — never sent to LLM as raw metadata,
instead baked into the prompt context phrase.

---

### Decision 4: Redis Cache Key Design

```
coach:{profileAId}:{profileBId}   TTL: 3600s (1 hour)
```

**Cache invalidation trigger:** When a new message is sent in a chat room,
the Node.js socket handler appends to MongoDB AND publishes to Redis pub/sub channel
`chat:new_message:{matchId}`. A subscriber in the Bull job layer deletes the coach cache key.

This means suggestions refresh after each new message (the most natural UX behaviour)
rather than serving stale suggestions for up to 1 hour while the conversation evolves.

The cache key uses `min(profileAId, profileBId) + ":" + max(...)` to make it order-independent:

```python
def cache_key(profile_a_id: str, profile_b_id: str) -> str:
    ids = sorted([profile_a_id, profile_b_id])
    return f"coach:{ids[0]}:{ids[1]}"
```

---

### Decision 5: Frontend UX — "Smart Suggestions" Not "AI"

User research in Indian matrimonial apps shows "AI" creates distrust (feels robotic,
privacy-violating). Use "💡 Smart Suggestions" as the label.

UI behaviour:
1. Button in chat header — Teal, 44×44px minimum
2. On click: show loading skeleton (~500ms typical)
3. Show 3 suggestions as pill chips above the input bar
4. Click chip → populates input (editable before send)
5. Dismiss button (×) closes the panel, remembers dismissal for 10 minutes (localStorage)
6. Error state: "Couldn't load suggestions — tap to retry" (Burgundy outline)

Suggestion chips must be **full sentence**, not just topic hints. Bad: "Ask about family."
Good: "Aapke ghar mein weddings ka माहौल kaisa hota hai?"

---

### Decision 6: Mock Mode Behaviour

```python
MOCK_SUGGESTIONS = [
    {"text": "Aap dono ko music pasand hai — kaunsa last concert attend kiya aapne?",
     "reason": "Shared music interest, invites personal story", "tone": "curious"},
    {"text": "Family ke saath weekend kaisa spend karte hain aap usually?",
     "reason": "Family orientation check, culturally natural", "tone": "warm"},
    {"text": "Agar ek baar trip plan karni ho bina budget concern ke — kahan jaoge?",
     "reason": "Dream-based question, reveals values and aspirations", "tone": "light"},
]
```

When `USE_MOCK_SERVICES=true`: return above instantly, no Helicone call, no Redis write.
This keeps dev fast and CI independent of external services.

---

### Decision 7: Internal API for Chat Messages

The ai-service needs the last 20 messages for a match to compute coach context.
It cannot hit MongoDB directly (different service, no Mongoose client in Python).

Pattern: ai-service calls Node.js internal endpoint, Node.js fetches from MongoDB.

```
ai-service → GET http://{API_HOST}/internal/chat/{matchId}/messages?limit=20
             Header: X-Internal-Key: {AI_SERVICE_API_KEY}
Node.js    → fetches from MongoDB, returns Message[]
```

This is already the established pattern. The `/internal/` prefix routes bypass auth middleware
but verify `X-Internal-Key`. This endpoint already exists for other internal calls —
add the messages route if not present.

---

### Decision 8: Agent Team Split

| Teammate | Domain | Files Owned |
|----------|--------|-------------|
| `ai-python` | apps/ai-service/src/ | `routers/coach.py`, `services/coach_service.py`, `schemas/coach.py`, `tests/test_coach.py`, `prompts/conversation-coach-v1.md` |
| `api-node` | apps/api/src/ | `routes/ai.ts` (ai coach section only), `services/aiService.ts` (coach functions), `routes/internal.ts` (messages endpoint), `src/jobs/` (cache invalidation on new message) |

**Single agent (after both teammates done):** Frontend chat UI changes.

**Why NOT 3 teammates for frontend:** The chat page touches Socket.io handlers which
are currently mounted in a single file. Concurrent edits = merge conflicts. Frontend
is ~2 hours of work — single agent is faster than coordination overhead.

---

## Phase 0 — AI Service Health Hardening

*Single agent. ~20 minutes. Must complete before teammates spawn.*

```
TASK: Harden apps/ai-service/src/main.py health endpoint for Phase 3.

1. Ensure GET /health returns:
   {
     "status": "ok",
     "phase": 3,
     "version": "3.0.0",
     "models": {
       "guna_milan": "deterministic",
       "coach": "llm_haiku",
       "emotional": "pending_week10_day3"
     }
   }
   If any import fails → status: "degraded", HTTP 200 still (Railway won't restart on 200)

2. Add X-Internal-Key middleware to ALL non-/health routes:
   File: apps/ai-service/src/deps/auth.py
   
   from fastapi import Header, HTTPException
   from app.core.config import settings
   
   async def verify_internal_key(x_internal_key: str = Header(...)):
       if x_internal_key != settings.AI_SERVICE_API_KEY:
           raise HTTPException(status_code=403, detail="Invalid internal key")
   
   Apply as Depends(verify_internal_key) to all routers EXCEPT /health.
   Horoscope router must also be updated if not already protected.

3. Verify apps/ai-service/railway.toml exists and has:
   [deploy]
   startCommand = "uvicorn src.main:app --host 0.0.0.0 --port $PORT"
   healthcheckPath = "/health"
   healthcheckTimeout = 30

4. Verify apps/api/.env.example has:
   AI_SERVICE_URL=http://localhost:8000
   AI_SERVICE_API_KEY=dev-internal-key-change-in-prod
   
   If missing — add them.

5. Run: cd apps/ai-service && pytest tests/ -v
   All existing 62 guna_milan tests must still pass.

Commit: "chore: ai-service Phase 3 health + internal auth hardening"
No plan approval needed — implement directly.
```

---

## Phase 1A — Agent Teammate: `ai-python`

*Paste as the ai-python teammate prompt. No plan approval mode.*

```
You are teammate ai-python. You own the Python ai-service work for the Conversation Coach.

FILES YOU OWN — touch nothing outside this list:
  apps/ai-service/src/routers/coach.py          (CREATE)
  apps/ai-service/src/services/coach_service.py (CREATE)
  apps/ai-service/src/schemas/coach.py          (CREATE)
  apps/ai-service/tests/test_coach.py           (CREATE)
  prompts/conversation-coach-v1.md              (CREATE)
  apps/ai-service/src/main.py                   (EDIT — router registration only)

DO NOT TOUCH:
  apps/api/ (anything)
  apps/web/ (anything)
  packages/ (anything)
  horoscope.py, guna_milan.py

─────────────────────────────────────────────────────────────

STEP 1: Create prompts/conversation-coach-v1.md

This is the system prompt for claude-haiku-4-5. It MUST:
- Open with: "You are a culturally intelligent matchmaking assistant for Smart Shaadi,
  India's premium matrimonial platform."
- Establish Indian arranged-marriage context explicitly (not Western dating)
- Instruct the model to generate EXACTLY 3 suggestions in XML format:
  <suggestions><suggestion><text>...</text><reason>...</reason><tone>warm|curious|light</tone></suggestion></suggestions>
- Forbid: relationship advice, physical compliments, marriage pressure, religious assertions
- Permit: family topics, career aspirations, hobbies, food, travel, life goals, future plans
- Include a few-shot example pair showing good vs bad suggestions
- Bilingual guidance: English suggestions fine, Hindi/Hinglish encouraged when natural
- State context phrase is injected as {state_context} and shared interests as {shared_interests}

─────────────────────────────────────────────────────────────

STEP 2: Create apps/ai-service/src/schemas/coach.py

from pydantic import BaseModel, Field
from typing import Literal

class ProfileSnapshot(BaseModel):
    profile_id: str
    interests: list[str] = Field(default_factory=list)
    hobbies: list[str] = Field(default_factory=list)
    bio: str = ""
    occupation: str = ""
    city: str = ""

class Message(BaseModel):
    sender: Literal["A", "B"]
    text: str
    timestamp: str  # ISO format

class CoachRequest(BaseModel):
    profile_a: ProfileSnapshot
    profile_b: ProfileSnapshot
    conversation_history: list[Message] = Field(default_factory=list)
    match_id: str

class CoachSuggestion(BaseModel):
    text: str
    reason: str
    tone: Literal["warm", "curious", "light"]

class CoachResponse(BaseModel):
    suggestions: list[CoachSuggestion]
    state: Literal["STARTING", "ACTIVE", "COOLING"]
    cached: bool = False

─────────────────────────────────────────────────────────────

STEP 3: Create apps/ai-service/src/services/coach_service.py

Implement these functions:

def detect_conversation_state(history: list[Message]) -> Literal["STARTING", "ACTIVE", "COOLING"]:
    """
    STARTING: len(history) < 6 or history is empty
    COOLING:  last message > 48 hours ago OR last 5 avg gap > 24h AND len > 6
    ACTIVE:   everything else
    Timestamps are ISO strings — parse with datetime.fromisoformat()
    """

def extract_shared_interests(profile_a: ProfileSnapshot, profile_b: ProfileSnapshot) -> list[str]:
    """
    Simple set intersection of interests + hobbies.
    Lowercase and strip before comparing.
    Return max 5 items. If 0 shared → return ["general life goals", "family values"]
    """

def build_prompt_context(state: str, shared: list[str], history: list[Message]) -> str:
    """
    state_context phrase examples:
      STARTING: "This is an early conversation — they have just started talking."
      ACTIVE:   "This is an engaged, ongoing conversation."
      COOLING:  "The conversation has slowed down — they haven't talked in a while."
    
    Format last 3 messages as:
      [Profile A]: message text
      [Profile B]: message text
    Truncate each message to 200 chars. If no history → "No messages yet."
    """

async def get_suggestions(
    request: CoachRequest,
    redis_client,
    anthropic_client,
    use_mock: bool
) -> CoachResponse:
    """
    1. Check Redis cache key (sorted profile IDs): "coach:{min_id}:{max_id}"
    2. If hit → return cached CoachResponse with cached=True
    3. If use_mock → return MOCK_SUGGESTIONS immediately, no cache write
    4. Detect state, extract shared interests, build context
    5. Load prompt template from prompts/conversation-coach-v1.md
    6. Call anthropic_client.messages.create() via Helicone headers:
         model="claude-sonnet-4-6"
         max_tokens=800
         temperature=0.7  (some warmth/variety in suggestions, not deterministic)
         system=prompt_template with {state_context} and {shared_interests} filled in
         messages=[{"role": "user", "content": f"Conversation history:\n{formatted_history}\n\nProfile A interests: {shared}\n\nGenerate 3 suggestions."}]
       Helicone headers required:
         "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}"
         "Helicone-Property-Feature": "conversation-coach"
         "Helicone-User-Id": request.profile_a.profile_id
         "Helicone-Cache-Enabled": "true"  (Helicone-side dedupe of identical inputs)
    7. Parse XML from response.content[0].text using re.findall
    8. Write to Redis with TTL=3600
    9. Return CoachResponse
    
    On ANY exception from Anthropic → log error, return MOCK_SUGGESTIONS (never fail user)
    """

MOCK_SUGGESTIONS = [
    CoachSuggestion(
        text="Aap dono ko music pasand hai — kaunsa last concert ya performance attend ki?",
        reason="Shared music interest opens personal storytelling",
        tone="curious"
    ),
    CoachSuggestion(
        text="Family ke saath weekends kaisa spend karte hain aap generally?",
        reason="Family-oriented question, natural in matrimonial context",
        tone="warm"
    ),
    CoachSuggestion(
        text="Agar ek baar budget ki chinta na ho toh — kahan travel karna chahoge?",
        reason="Dream question reveals values and aspirations",
        tone="light"
    ),
]

─────────────────────────────────────────────────────────────

STEP 4: Create apps/ai-service/src/routers/coach.py

from fastapi import APIRouter, Depends
from app.deps.auth import verify_internal_key
from app.schemas.coach import CoachRequest, CoachResponse
from app.services.coach_service import get_suggestions
from app.core.config import settings
# import redis and anthropic clients from app.core.clients (create if not exists)

router = APIRouter(prefix="/ai/coach", tags=["coach"])

@router.post("/suggest", response_model=CoachResponse)
async def suggest(
    request: CoachRequest,
    _: None = Depends(verify_internal_key)
) -> CoachResponse:
    return await get_suggestions(
        request,
        redis_client=...,    # from app state or DI
        anthropic_client=...,
        use_mock=settings.USE_MOCK_SERVICES
    )

Register router in src/main.py: app.include_router(coach_router)

─────────────────────────────────────────────────────────────

STEP 5: Create apps/ai-service/tests/test_coach.py

Minimum 8 tests using pytest + pytest-asyncio. Mock the Anthropic client.

1. test_detect_state_starting_empty_history
2. test_detect_state_starting_few_messages (< 6)
3. test_detect_state_cooling_old_last_message (> 48h ago)
4. test_detect_state_active
5. test_extract_shared_interests_with_overlap
6. test_extract_shared_interests_no_overlap_returns_defaults
7. test_get_suggestions_mock_mode_no_api_call
8. test_get_suggestions_response_structure_valid
9. test_suggestion_xml_parsing_with_valid_response (mock Anthropic response)
10. test_cache_hit_returns_cached_true

Run: pytest tests/test_coach.py -v
All 10 tests must pass + all 62 existing guna_milan tests must still pass.
Commit your work when done. Signal: create file .ai-python-done at repo root.
```

---

## Phase 1B — Agent Teammate: `api-node`

*Spawn concurrently with ai-python. No plan approval mode.*

```
You are teammate api-node. You own the Node.js API work for the Conversation Coach.

FILES YOU OWN — touch nothing outside this list:
  apps/api/src/services/aiService.ts              (EDIT — add coach section)
  apps/api/src/routes/ai.ts                       (CREATE or EDIT — add coach route)
  apps/api/src/routes/internal.ts                 (EDIT — add /internal/chat/:matchId/messages)
  apps/api/src/__tests__/ai.coach.test.ts         (CREATE)

DO NOT TOUCH:
  apps/ai-service/ (anything)
  apps/web/ (anything)
  packages/ (anything)
  Socket.io handlers

─────────────────────────────────────────────────────────────

STEP 1: Add internal chat messages endpoint

In apps/api/src/routes/internal.ts (create if it doesn't exist):

GET /internal/chat/:matchId/messages?limit=20

Middleware: verify X-Internal-Key === process.env.AI_SERVICE_API_KEY
If missing/wrong → 403

Handler:
- Parse limit from query (default 20, max 50)
- Query MongoDB Chat collection for the matchId
- Return last `limit` messages sorted by createdAt asc
- Map to: { sender: "A"|"B", text: string, timestamp: string }
  sender "A" = first participant in chat.participants[], "B" = second
- Return: { success: true, data: { messages: Message[], matchId } }

Mount in apps/api/src/index.ts: app.use('/internal', internalRouter)
Internal routes must NOT go through the Better Auth session middleware.

─────────────────────────────────────────────────────────────

STEP 2: Add AI service client functions

In apps/api/src/services/aiService.ts add:

Types (import from packages/types if they exist, else define locally):
  interface ProfileSnapshot {
    profile_id: string
    interests: string[]
    hobbies: string[]
    bio: string
    occupation: string
    city: string
  }
  
  interface CoachSuggestion {
    text: string
    reason: string
    tone: 'warm' | 'curious' | 'light'
  }
  
  interface CoachResponse {
    suggestions: CoachSuggestion[]
    state: 'STARTING' | 'ACTIVE' | 'COOLING'
    cached: boolean
  }

Function:
  async function getConversationSuggestions(
    profileA: ProfileSnapshot,
    profileB: ProfileSnapshot,
    conversationHistory: { sender: 'A'|'B'; text: string; timestamp: string }[],
    matchId: string
  ): Promise<CoachResponse>

Implementation:
  const response = await fetch(`${process.env.AI_SERVICE_URL}/ai/coach/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': process.env.AI_SERVICE_API_KEY!,
    },
    body: JSON.stringify({ profile_a: profileA, profile_b: profileB,
                           conversation_history: conversationHistory, match_id: matchId }),
    signal: AbortSignal.timeout(12000), // 12s timeout — Sonnet 4.6 p99 latency + safety margin
  })
  
  if (!response.ok) {
    throw new AppError('AI_SERVICE_UNAVAILABLE', 'Conversation suggestions unavailable', 503)
  }
  return response.json() as Promise<CoachResponse>

─────────────────────────────────────────────────────────────

STEP 3: Create the Express route

In apps/api/src/routes/ai.ts (create if not exists):

POST /api/v1/ai/coach/suggest
Auth: requireAuth middleware (valid session)
Rate limit: 10 requests per user per hour (use existing rateLimiter utility or Redis INCR/EXPIRE)

Handler:
1. Extract userId from req.user (Better Auth session)

2. CRITICAL — resolve profileId from userId:
   const profile = await db.select({ id: profiles.id, interests: profiles.interests,
     hobbies: profiles.hobbies, bio: profiles.bio, occupation: profiles.occupation,
     city: profiles.city })
     .from(profiles).where(eq(profiles.userId, req.user.id)).limit(1)
   if (!profile[0]) return res.status(404).json({ success: false, error: { code: 'PROFILE_NOT_FOUND' } })

3. Get matchId from req.body. Verify the requesting user is a participant in this match:
   const match = await db.select().from(matchRequests)
     .where(and(eq(matchRequests.id, matchId), eq(matchRequests.status, 'ACCEPTED')))
     .limit(1)
   Verify profile[0].id === match[0].requesterId OR match[0].receiverId — else 403.

4. Fetch the other profile (the match partner):
   const otherProfileId = match[0].requesterId === profile[0].id
     ? match[0].receiverId : match[0].requesterId
   const otherProfile = await db.select({...same fields...})
     .from(profiles).where(eq(profiles.id, otherProfileId)).limit(1)

5. Fetch last 20 messages from internal endpoint:
   const msgResponse = await fetch(
     `${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/internal/chat/${matchId}/messages?limit=20`,
     { headers: { 'X-Internal-Key': process.env.AI_SERVICE_API_KEY! } }
   )
   const { data } = await msgResponse.json()

6. Build ProfileSnapshot objects from DB results (map interests/hobbies — handle null as [])

7. Call aiService.getConversationSuggestions(...)

8. On AppError with code AI_SERVICE_UNAVAILABLE → return graceful fallback:
   { success: true, data: { suggestions: [], state: 'STARTING', cached: false,
     fallback: true } }
   Never surface the error to the user — just return empty suggestions silently.

9. Return: { success: true, data: coachResponse }

Mount router in apps/api/src/index.ts.

─────────────────────────────────────────────────────────────

STEP 4: Tests

In apps/api/src/__tests__/ai.coach.test.ts:

1. test: POST /api/v1/ai/coach/suggest without auth → 401
2. test: POST with invalid matchId (not participant) → 403
3. test: POST with valid matchId → 200, suggestions array present
   (mock aiService.getConversationSuggestions to return MOCK_SUGGESTIONS)
4. test: aiService timeout → returns fallback response, not 500

Run: pnpm --filter @vivah/api test
All tests must pass. pnpm type-check must show 0 errors.
Commit your work. Signal: create file .api-node-done at repo root.
```

---

## Phase 2 — Single Agent: Frontend Integration

*Run after BOTH .ai-python-done and .api-node-done files exist.*

```
Teammates have completed the Conversation Coach backend.
Verify their work:
  curl -X POST http://localhost:8000/ai/coach/suggest \
    -H "X-Internal-Key: dev-internal-key-change-in-prod" \
    -H "Content-Type: application/json" \
    -d '{"profile_a":{"profile_id":"a1","interests":["music","trekking"],"hobbies":[],"bio":"","occupation":"Engineer","city":"Pune"},"profile_b":{"profile_id":"b1","interests":["music","cooking"],"hobbies":[],"bio":"","occupation":"Doctor","city":"Pune"},"conversation_history":[],"match_id":"test-match-1"}'
  # Expect: { suggestions: [{text, reason, tone}x3], state: "STARTING", cached: false }

  curl -X POST http://localhost:4000/api/v1/ai/coach/suggest \
    -H "Authorization: Bearer {your_test_token}" \
    -H "Content-Type: application/json" \
    -d '{"matchId":"your-test-match-id"}'
  # Expect: { success: true, data: { suggestions: [...] } }

If either fails → fix before building frontend.

─────────────────────────────────────────────────────────────

Now build the frontend. All changes in apps/web/.

FILE: apps/web/app/(dashboard)/matches/[matchId]/chat/page.tsx (or wherever chat UI lives)

1. CREATE: apps/web/components/chat/SmartSuggestions.client.tsx

Props:
  interface SmartSuggestionsProps {
    matchId: string
    isOpen: boolean
    onClose: () => void
    onSelect: (text: string) => void
  }

State:
  - suggestions: CoachSuggestion[] | null
  - loading: boolean
  - error: boolean

Behaviour:
  - On mount (when isOpen becomes true): fetch /api/v1/ai/coach/suggest with matchId
  - Loading state: 3 skeleton pill chips (animate-pulse, Teal/20 bg)
  - Error state: "Couldn't load suggestions" in Burgundy #7B2D42 + retry button
  - Success: render 3 pill chips, full sentence text, tap → call onSelect(text)
  - Dismiss (×) button top-right — calls onClose()
  - Store dismiss timestamp in localStorage key "coach_dismissed_{matchId}"
    If dismissed < 10 minutes ago → don't show (prevents re-open spam)
  - NEVER show if suggestions array is empty (fallback case)

Styling (must match design system):
  Container: fixed bottom bar above input, bg-white border-t border-[#C5A47E]/30
             rounded-t-xl p-3 shadow-lg
  Label: "💡 Smart Suggestions" text-[#7B2D42] font-semibold text-sm Playfair Display
  Chips: bg-[#0E7C7B]/10 border border-[#0E7C7B]/30 rounded-full px-3 py-2
         text-[#0E7C7B] text-sm min-h-[44px] flex items-center
         hover:bg-[#0E7C7B]/20 transition-colors cursor-pointer
  Dismiss: text-[#6B6B76] hover:text-[#2E2E38] top-2 right-2 absolute
  Mobile: chips stack vertically on < 375px (flex-col)

2. EDIT: Chat page — add the trigger button

In the chat header bar (next to video call button):
  <button
    onClick={() => setShowSuggestions(true)}
    className="min-h-[44px] min-w-[44px] flex items-center justify-center
               rounded-lg bg-[#0E7C7B]/10 hover:bg-[#0E7C7B]/20
               text-[#0E7C7B] transition-colors"
    aria-label="Smart Suggestions"
    title="Smart Suggestions"
  >
    💡
  </button>

  <SmartSuggestions
    matchId={matchId}
    isOpen={showSuggestions}
    onClose={() => setShowSuggestions(false)}
    onSelect={(text) => {
      setMessageInput(text)  // populate chat input
      setShowSuggestions(false)
    }}
  />

3. Types: Add to packages/types/src/ai.ts (create if not exists):
   export interface CoachSuggestion { text: string; reason: string; tone: 'warm'|'curious'|'light' }
   export interface CoachResponse { suggestions: CoachSuggestion[]; state: string; cached: boolean; fallback?: boolean }

4. Server Action (apps/web/app/actions/ai.ts — create if not exists):
   'use server'
   export async function fetchCoachSuggestions(matchId: string): Promise<CoachResponse> {
     const session = await getServerSession() // Better Auth
     const res = await fetch(`${process.env.API_URL}/api/v1/ai/coach/suggest`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.accessToken}` },
       body: JSON.stringify({ matchId }),
       cache: 'no-store',
     })
     if (!res.ok) return { suggestions: [], state: 'STARTING', cached: false, fallback: true }
     return res.json().then(r => r.data)
   }

─────────────────────────────────────────────────────────────

After UI complete:
  pnpm type-check
  pnpm lint
  pnpm test (511 baseline must hold)
  
  Manual smoke test:
  1. Log in as two matched users
  2. Open chat for an accepted match
  3. Click 💡 button → see 3 suggestions within 3 seconds (Sonnet 4.6 typical: 1.5–2.5s)
  4. Click a suggestion → populates input
  5. Edit and send → suggestions panel closes
  6. USE_MOCK_SERVICES=true → suggestions appear instantly without Helicone call (check logs)
  7. Quality check: re-roll suggestions 5× — each set should feel culturally appropriate,
     none should sound robotic or use Western dating-app phrasing

Commit: "feat: AI Conversation Coach — Week 10 Step 1 complete"
Delete .ai-python-done and .api-node-done signal files.
```

---

## Phase 3 — Deploy Verification

```bash
# Push to GitHub (from Windows PowerShell — WSL has no git credentials)
# Then verify Railway auto-deploys ai-service

# After Railway deploy completes:
curl https://api.smartshaadi.co.in/internal/health   # → { status: ok, phase: 3 }

# Check Railway env vars are set:
# AI_SERVICE_URL → internal Railway URL of ai-service
# AI_SERVICE_API_KEY → matches what's in ai-service
# ANTHROPIC_API_KEY → set
# HELICONE_API_KEY → set

# Monitor Helicone dashboard after first real user triggers the coach
# Expect: traces tagged feature=conversation-coach, model=claude-haiku-4-5
```

---

## Final Verification Checklist

```
[ ] pytest apps/ai-service/tests/ -v → all tests pass (62 existing + 10 new coach tests)
[ ] pnpm test → 511+ tests passing (no regression)
[ ] pnpm type-check → 0 errors
[ ] pnpm lint → 0 errors
[ ] GET /health on Railway → { status: "ok", phase: 3 }
[ ] POST /ai/coach/suggest with X-Internal-Key → 200 with 3 suggestions
[ ] POST /api/v1/ai/coach/suggest (authenticated) → 200 with data.suggestions
[ ] Frontend: 💡 button visible in chat header on 375px viewport (44px touch target)
[ ] Frontend: suggestions appear within 3s (mock mode < 100ms; live Sonnet 4.6 ~1.5–2.5s)
[ ] Frontend: clicking suggestion populates input
[ ] USE_MOCK_SERVICES=true: no Helicone/Anthropic calls in logs
[ ] USE_MOCK_SERVICES=false: Helicone trace visible, model=claude-sonnet-4-6, feature=conversation-coach
[ ] Unauthenticated request → 401
[ ] Non-participant matchId → 403
[ ] ai-service down → graceful fallback (empty suggestions, no 500 to user)
```

---

## Commit Sequence

```
chore: ai-service Phase 3 health + internal auth hardening
feat(ai-service): Conversation Coach — schemas, service, router, prompt
feat(api): Conversation Coach — internal messages endpoint + AI route + aiService
feat(web): Smart Suggestions UI — chat integration
```

---

## What's Next (Week 10, Step 2)

After this step is merged and smoke-tested on production:

**Emotional Score** — HuggingFace sentiment model (cardiffnlp/twitter-xlm-roberta-base-sentiment),
Bull daily job, emotional badge in chat header (Teal/Gold/Burgundy based on score).
**No LLM required** — pure ML inference on message history. Free at runtime, no API costs.
Estimated: 1 day Python + 0.5 day Node.js + 0.5 day frontend.

## Model Strategy Across Phase 3

| Feature | Model | Why |
|---------|-------|-----|
| Conversation Coach | `claude-sonnet-4-6` | Realtime, quality-critical, latency-tolerant |
| Emotional Score | HuggingFace local | Pure inference, no LLM needed |
| Divorce Probability Indicator | `claude-opus-4-7` (narrative only) + sklearn (score) | High-stakes private feature, narrative needs Opus's reasoning depth |
| Family Inclination Index | Rule-based + `claude-sonnet-4-6` (interpretation) | Mostly deterministic, LLM polishes the explanation |
| Function Attendance Quotient | sklearn GradientBoosting | Pure ML, no LLM |
| Stay Quotient | sklearn LogisticRegression | Pure ML, admin-only |

Net effect: only Coach + DPI + FII narrative actually hit Anthropic API in production.
Other 3 features run entirely on your Railway compute. Keeps API spend predictable.
