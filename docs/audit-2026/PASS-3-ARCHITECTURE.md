# Smart Shaadi — Audit PASS 3: Architecture Rules

> **Audit and fix are separated.** This pass *records* how the code measures up
> against the 11 non-negotiable architecture rules in `CLAUDE.md`. It fixes
> **nothing**. Each finding is evidence-backed (`file:line`) and carries a
> severity. A remediation may be sketched, but is **deferred** until a fix pass is
> explicitly authorised. Ground-truth inventory: `PASS-0-INVENTORY.md`; general
> findings log: `PASS-1-FINDINGS.md`.

- **Date:** 2026-07-26
- **Scope:** `apps/**` + `packages/**` (`web`, `api`, `ai-service`, `mobile`; `types`, `schemas`, `db`, `api-client`)
- **Method:** GNU `grep` + direct file reads over the native ext4 tree, plus 3 parallel evidence agents (LLM-boundary/blocking-IO · Server-Actions/repos/envelope · Guna/reciprocal/R2). **Every agent-sourced claim was re-verified by hand** before it was allowed into this report.

**Severity scale** (same as PASS-1)
- **P0** — active breakage / data-loss / security exposure now.
- **P1** — latent break that can take a core flow down with no code change on our side (deploy/dependency/data-triggered), or a silent-correctness hazard on a core path.
- **P2** — correctness/robustness gap with limited blast radius; cleanup.
- **OBS** — observation / rule-vs-reality note; not a defect.

---

## Headline

The architecture rules are in **strong** shape. The audit found:

- **One clear violation worth acting on — P1 (Rule 9):** presigned Cloudflare R2 URLs are rendered through `next/image` on the highest-traffic surfaces (match-feed cards, profile hero).
- **Two P2 hygiene findings:** ~100 bare `throw new Error()` in API business logic that collapse to opaque `500`s (Rule 8); a cluster of `as unknown as` date casts + one `as any` (Rule 1).
- **Everything else PASSes** — LLM boundary, no-blocking-IO, Server-Actions-only mutations, mock pattern, API envelope, Guna Milan determinism, reciprocal matching.

**The P0 this pass was specifically told to hunt — `USE_MOCK_SERVICES` being a
string `'true'` treated as a boolean — does NOT exist.** `apps/api/src/lib/env.ts:24`
normalises it to a real boolean at parse time (`z.string()…transform(v => v === 'true')`),
and every raw read elsewhere uses an explicit `=== 'true'` compare. There is no
truthy-string-always-true hazard, in dev or prod. See Rule 7.

### Verdict summary

| Rule | Subject | Verdict | Severity |
|---|---|---|---|
| 1 | No `any` / escape hatches | PASS (2 minor) | P2 |
| 2 | LLM call boundary | **PASS** | — |
| 3 | No blocking IO in handlers | **PASS** | — |
| 4 | Mutations via Server Actions | **PASS** (strong) | — |
| 5 | `use client` only where needed | OBS (high ratio) | — |
| 6 | Repository discipline | PASS (web) / OBS (api) | — |
| 7 | Mock pattern & flag typing | **PASS** (well-built) | — |
| 8 | API envelope + typed errors | Envelope PASS / errors PARTIAL | P2 |
| 9 | R2 signed URLs use plain `<img>` | **VIOLATION** | **P1** |
| 10 | Guna Milan determinism + coverage | **PASS** | — |
| 11 | Reciprocal matching (both sides) | **PASS** | — |

---

## Rule 1 — No `any`; no unjustified escape hatches → PASS (2 minor P2s)

**What.** `any` is banned by lint and the ban is honoured. The only real occurrences
are one deliberate `as any` and a small cluster of `as unknown as` double-casts.

**Evidence.**
- Enforced: `eslint.config.js:59` — `'@typescript-eslint/no-explicit-any': 'error'` for all `*.ts/*.tsx`; `:72` turns it `'off'` **only** for test files (`**/__tests__/**`, `*.test.ts`).
- The **one** real `any` in production source: `apps/web/src/app/[locale]/(onboarding)/profile/complete/page.tsx:23` — `const json = await res.json() as any;` with an `eslint-disable-next-line` on `:22` **but no reason text**.
- `apps/web/src/components/shared/DataTable.tsx:19` — the `as any` there is only inside a JSDoc comment; the real default render at `:49` uses `(row as Record<string, unknown>)[key]`. **Not** a violation.
- `as unknown as` double-casts, **none carrying a justification comment**, all coercing Drizzle date/timestamp columns to `string | null`:
  - `apps/api/src/weddings/coordinator.service.ts:260, 266, 272, 357`
  - `apps/api/src/weddings/dayOf.service.ts:119`
  - `apps/api/src/weddings/expenses.service.ts:370`
  - (Also `apps/web/sentry.server.config.ts`, `sentry.edge.config.ts`, `apps/mobile/src/lib/auth-client.ts` — library-integration glue, lower concern.)
- `@ts-ignore` / `@ts-expect-error`: **zero** in non-test source.

**Why P2.** The `res.json() as any` and the six weddings casts each bypass the type
system with no compiler check and no rationale. The weddings casts specifically hide
a real `Date`-vs-`string` mismatch (the column is a `Date`, the API contract wants a
`string`) — a double-assertion papers over it instead of serialising properly. Limited
blast radius, no runtime break today → P2. Everything else is clean; the lint gate is
doing its job.

---

## Rule 2 — All LLM calls route through `apps/ai-service/` (or `apps/web/lib/ai/`) → PASS

**What.** Every LLM provider SDK call is confined to the Python AI service. The Node
API and the web app reach LLMs only by HTTP proxy — they import no LLM SDK at all.

**Evidence.**
- LLM SDK usage lives **only** in `apps/ai-service/src/services/**`:
  `llm_client.py` (anthropic + openai adapters, ~`:166-181`), `coach_service.py:330`,
  `assistant_service.py:389`, `fii_service.py:431`, `dpi_service.py:274`,
  `marketing_service.py:117`.
- Node API → AI: `apps/api/src/lib/ai.ts:28` `callAiService<T>()` is a pure HTTP proxy
  (`fetch(`${env.AI_SERVICE_URL}${path}`, { headers: { 'X-Internal-Key': … } })`), plus
  `apps/api/src/services/aiService.ts` and `routes/{ai,assistant}.ts` which all `fetch`
  the ai-service. **No** `anthropic`/`openai`/`GoogleGenerativeAI` import in `apps/api`.
- Web → API: `apps/web/src/lib/assistant-api.ts` streams from `${API_BASE}/api/v1/assistant/chat`. **No** LLM SDK in `apps/web`, `apps/mobile`, or `packages/**`.

**Note.** `CLAUDE.md` names `apps/web/lib/ai/index.ts` as an allowed boundary; that path
does not exist — the web app never calls an LLM directly, so the rule is satisfied more
strictly than written. (Doc could drop the stale reference.)

---

## Rule 3 — No blocking LLM/IO in request handlers; background work via Bull → PASS

**What.** Fire-and-forget IO (SMS/email/push) is enqueued on the request path and sent
from a queue worker. No provider `send*` runs synchronously in a handler.

**Evidence.**
- Providers: `notifications/providers/ses.ts:27` `sendEmail`, `msg91.ts:7` `sendSms`,
  `fcm.ts:27` `sendPush`. They are awaited **only** inside the worker dispatcher
  `notifications/service.ts:384/391/397` (`deliverNotification`), which is invoked from
  `jobs/notificationsWorker.ts:23` — never from a route.
- Request path enqueues: `notifications/service.ts:87` `notificationsQueue.add(...)`
  (BullMQ, `infrastructure/redis/queues.ts:46`); callers use `queueNotification()`
  (`video/service.ts`, `retention/service.ts`, `marketing/service.ts`,
  `weddings/coordinator.service.ts`, …).
- The only other direct provider importers are **jobs**: `guests/invitation.ts`
  (`sendInvitations`) is imported solely by `jobs/{rsvpReminder,saveTheDate,thankYou}Job.ts`;
  `services/dataExportService.ts` (`sendEmail` at `:208`) is driven by `jobs/dataExportJob.ts`
  while `routes/gdpr.ts` only enqueues/reads.
- Real OTP SMS is not wired yet — `auth/config.ts:137` `throw new Error('MSG91 integration not yet implemented')` — so there is no live synchronous send today.

**OBS — clarify the rule, not a violation.** Interactive AI features **do** await an LLM
on the request path via the HTTP proxy: `routes/ai.ts:269-276` (conversation suggestions),
`:445/711/963`, and `routes/assistant.ts` (assistant stream). This is correct — the LLM
output *is* the HTTP response, so it cannot be fire-and-forget queued — and each call is
timeout-guarded (5–12s) with a graceful fallback. Rule 3 targets *fire-and-forget* IO
(SMS/email/push/heavy jobs), which is correctly queued; it should not be read as "zero
awaited LLM in any handler."

**OBS — future.** Better Auth's `sendOTP` callback is on the request path, so when MSG91
lands the OTP send will be request-synchronous. That is inherent to OTP UX (the user is
waiting for the code) — flag it for awareness, not as a defect.

---

## Rule 4 — Next.js mutations via Server Actions, not API routes → PASS (strong)

**What.** The web app has **no** route handlers at all; every mutation goes through a
Server Action, which is a thin wrapper over the Node API.

**Evidence.**
- `find apps/web -name 'route.ts' -o -name 'route.tsx'` → **zero** results. There are no
  Next.js API routes in the web app.
- **46** files carry the `'use server'` directive (`apps/web/src/**`), e.g.
  `app/[locale]/(app)/notifications/actions.ts`, `feed/actions.ts`, `admin/users/actions.ts`.
  These call the Node API over `fetch` (e.g. `admin/users/actions.ts` PATCHes the backend).
- All mutating endpoints live in `apps/api` Express routers (e.g.
  `users/router.ts:28` `PATCH /me/role`, `profiles/router.ts:63` `PUT /me`) — the correct
  place, not Next.js.

---

## Rule 5 — `use client` only where genuinely needed → OBS (no hard violation found)

**What.** The client-component ratio is high, but a mechanical scan cannot substantiate a
specific "unnecessary" client component — the low-interactivity candidates are all
framework- or library-mandated.

**Evidence.**
- 361 of 744 `.tsx` files (~49%) begin with `'use client'`.
- Scanning those 361 for files with no interactivity signal (no `useState/useEffect/useRef`,
  no `on*=` handlers, no `window/document/localStorage`, no router/query/motion hooks)
  surfaced 102 candidates. Of those, **79 are `error.tsx` files** — App Router error
  boundaries **must** be Client Components. The remainder are shadcn/Radix UI primitives
  (`ui/{dialog,select,tabs,popover,accordion,…}.tsx` — client by design), chart components
  (`analytics/*Chart.client.tsx`), an upload component (`PhotosClient.client.tsx`), and
  form/avatar helpers. None is a clear-cut unnecessary client component.

**Why OBS.** ~49% client is worth watching for SSR/perf cost, but a defensible
"unnecessary `use client`" verdict requires per-component semantic review (does it actually
touch the browser?), which a mechanical pass cannot deliver. No P-level finding is
warranted from the evidence available.

---

## Rule 6 — DB queries live in `packages/db`, never inline in components/actions → PASS (web) / OBS (api)

**What.** The web app holds **no** DB access; API services own their queries inline — an
intentional layering, though it differs from a literal reading of the rule.

**Evidence.**
- `apps/web/src`: **zero** inline Drizzle — no `db.select/insert/update/delete(`, no
  `drizzle-orm` import, no `@smartshaadi/db` query usage in components or Server Actions.
  Server Actions are thin HTTP wrappers over the API. Fully compliant with the intent.
- `apps/api/src`: services query Drizzle **inline** (e.g. `matchmaking/*`, `profiles/service.ts`,
  `vendors/*`, `payments/{dispute,subscriptions}.ts`). `packages/db` holds schema + migrations
  + seed only (`packages/db/index.ts` re-exports `./schema/index`).

**Why OBS.** The literal rule ("*all* DB queries live in `packages/db`") is **not** how the
Node API is built, and reasonably so — services own their queries; `packages/db` owns the
schema. The invariant that actually matters — no DB queries in web components/Server Actions
— is upheld. Recommend restating the rule as "no inline DB queries in `apps/web`; API
services own their queries" so the doc matches reality.

---

## Rule 7 — Per-service mock flags; `USE_MOCK_SERVICES` is not a truthy string → PASS (well-architected)

**What.** The flag is normalised to a boolean at parse time, per-service gates are derived
from one pure formula, and a production guard blocks mock mode in prod. The string-truthy
P0 this pass was told to hunt is **not present**.

**Evidence.**
- `apps/api/src/lib/env.ts:24` — `USE_MOCK_SERVICES: z.string().default('false').transform(v => v === 'true')`. So `env.USE_MOCK_SERVICES` is a **real boolean**; `if (env.USE_MOCK_SERVICES)` is correct, not always-true.
- Every raw read uses an explicit compare, never a bare truthy check:
  `kyc/rekognition.ts:59,94`, `auth/securityRouter.ts:303`, and web
  `settings/billing/page.tsx:92` all do `process.env['USE_MOCK_SERVICES'] === 'true'`.
  No `if (process.env.USE_MOCK_SERVICES)` truthy check exists anywhere.
- Per-service gates via one pure formula `deriveMockFlags()` (`env.ts:394`), each a distinct
  export (`shouldUseMockMongo/R2/Video/Kyc/Esign/WhatsApp/Lending/Insurance`, `env.ts:431-494`):
  - **EARLY-escape** (`useMock && !X_LIVE`) for Mongo/R2/Video — can go live while the master toggle stays on.
  - **INVERTED** (`useMock || !X_LIVE`) for KYC/Esign/WhatsApp/Lending/Insurance — stay mocked until explicitly enabled.
  - Truth table asserted by `flagParity.test.ts`.
- Razorpay/MSG91 gate on the master flag **by design** (`CLAUDE.md`: "Mocks: Razorpay + MSG91 only") — not a new service smuggled onto the blanket flag.
- Production safety: `env.ts:294` forbids `NODE_ENV=production && USE_MOCK_SERVICES=true` unless `ALLOW_MOCK_SERVICES_IN_PROD=true` is set explicitly.

**Why PASS.** The exact failure mode the brief warns about (a mock enabled in prod, or a
live call in dev, because a string was treated as a boolean) cannot occur here. New
services that must be independently live-able already follow the `deriveMockFlags` pattern.
This is a model implementation of the rule.

---

## Rule 8 — API envelope everywhere; typed errors, never bare `throw new Error()` → Envelope PASS / typed-errors PARTIAL (P2)

**What.** The `{ success, data, error, meta }` envelope is used consistently. Typed errors
are only partially adopted: ~100 bare `throw new Error()` in business logic collapse to
opaque `500`s.

**Evidence — envelope (PASS).**
- Helper `apps/api/src/lib/response.ts` — `ok()` → `{ success:true, data, error:null, meta }`, `err()` → `{ success:false, data:null, error:{code,message,…}, meta }`.
- Adherence: **1471** `ok()/err()` calls vs **55** raw `res.json(` (excluding tests/`response.ts`). The raw ones are principled: Razorpay `payments/webhook.ts` (external webhook contract) and dev/infra stubs (`storage/mockR2.router.ts`, `storage/media.router.ts`) — most still hand-build the `{ success, … }` shape.

**Evidence — typed errors (PARTIAL, P2).**
- Global error middleware `index.ts:533` maps `ZodError`→`VALIDATION_ERROR` (400), PG `22P02`→`INVALID_ID` (400), JSON-parse→`INVALID_JSON` (400), Mongoose `CastError`→`INVALID_ID` (400), and **everything else → `INTERNAL_ERROR` 500 with the message hidden** (`:565`).
- **101** bare `throw new Error(` in non-test business logic (kyc across 8 files, payments, marketing, matchmaking, profiles, guests, weddings, rentals, …). Per-module typed error classes **exist and are the intended tool** (`RefundError`, `InvoiceError`, `PayoutError`, `WalletError`, `VendorApprovalError`, `ReviewError`, `ReportsServiceError`, …), but the bare throws bypass them — losing the semantic `code`/`status`. `lib/ai.ts:12-19` documents this exact hazard: a bare `new Error()` has no `code`, so downstream `if (err.code === …)` guards never fire and an outage surfaces as an opaque 500.
- **Concrete contrast worth fixing first.** `payments/dispute.ts` has **14** bare throws on the escrow/dispute flow — `:64/83/219` "Booking not found" (should be 404), `:67/205/497` "Forbidden…" (should be 403), `:86/99/222` invalid-state, `:115` already-disputed (409). Its router catch falls back to `code ?? 'INTERNAL'` / `status ?? 500`, so **every one reaches the client as a `500`**. The correct pattern sits in the same folder: `payments/subscriptions.ts:41-42` defines `interface ServiceError extends Error { code; status }` + an `err(msg, code, status)` factory, throws `err('Plan not found','NOT_FOUND',404)` (`:120`), and the router extracts `code`/`status` into the envelope. `dispute.ts` should adopt that.

**Why P2.** No data corruption and the throw still fails safely (the bad mutation is
prevented). The damage is error-contract quality: `4xx`-class conditions (not-found,
forbidden, conflict, validation) surface as `500`, so clients can't distinguish
"you did something wrong" from "the server broke," and on-call sees noise. Limited blast
radius → P2, but the `dispute.ts` cluster is the highest-value place to start.

---

## Rule 9 — R2 signed URLs rendered with plain `<img>`, not `next/image` → VIOLATION (P1)

**What.** Short-lived presigned R2 URLs are rendered through `next/image` on the app's
busiest surfaces.

**Evidence.**
- Profile photos are **presigned R2 GET URLs** with a 15-minute expiry:
  `apps/api/src/storage/service.ts:33` `getSignedUrl(r2, new GetObjectCommand(...), { expiresIn })`;
  `apps/api/src/storage/media.router.ts:12` notes the "15-minute presign expiry";
  `profiles/photos.service.ts:118/155` and `profiles/service.ts:371` mint them for photo results.
- `apps/web/src/components/ui/ImageWithFallback.client.tsx:3` imports `Image` from `next/image`
  and `:51` renders `<Image src={src} … />`.
- That wrapper is fed presigned URLs by the core browse/profile surfaces:
  `apps/web/src/components/profile/PhotoGallery.client.tsx` (`photo.url`),
  `apps/web/src/components/ui/ProfileCard.client.tsx:127` (`photoUrl` — **match-feed cards**),
  `apps/web/src/components/profile/ProfileHero.tsx:72` (`photoUrl`).
- `apps/web/next.config.ts:12-13` allows `**.r2.cloudflarestorage.com` / `**.r2.dev` in
  `images.remotePatterns`, so the optimizer *accepts* these URLs rather than erroring.
- Correct counter-example already in the codebase: `apps/web/src/components/ui/PhotoLightboxModal.client.tsx:122` renders `<img src={active} … />` (plain, no proxy).

**Why P1.** Two costs, both on the highest-traffic surface (the match feed):
1. **Present, guaranteed waste.** Each request mints a *fresh, unique* signed URL, so the
   `/_next/image?url=…` cache key is new every single load — the optimizer re-fetches from R2
   and re-encodes on **every** card render, defeating image caching entirely and adding
   latency + Vercel image-optimization cost on the busiest page.
2. **Latent break with no code change on our side.** The rule exists because the Next image
   proxy strips/normalises the signed query string; a Next optimizer behavior change, an
   expiry race, or a signature-encoding edge can turn feed photos into broken images —
   triggerable by a dependency bump, not by us. Blast radius = every photo on the feed and
   profile screens.

Fix direction (deferred): render presigned R2 URLs with a plain `<img>` (as
`PhotoLightboxModal` already does) — either switch `ImageWithFallback` to `<img>` for R2
sources, or add an `unoptimized` path; and drop the R2 hosts from `remotePatterns` (or
document them as test-only) so the proxy can't silently re-enable.

---

## Rule 10 — Guna Milan is pure deterministic math with full coverage → PASS

**What.** The Ashtakoot engine is deterministic lookup-table arithmetic — no randomness, no
LLM, no network — with all 8 factors, 6 doshas, and a large test suite.

**Evidence.**
- `apps/ai-service/src/services/guna_milan.py` (1,056 LOC): **no** `random`, `numpy.random`,
  `secrets`, `uuid`, no time-based branching, no network call, no `joblib.load`/anthropic/gemini.
- All 8 Ashtakoot factors present (`:975-983`): Varna(1), Vashya(2), Tara(3), Yoni(4),
  Graha Maitri(5), Gana(6), Bhakoot(7), Nadi(8). All 6 doshas (`:1005-1011`): Mangal, Nadi,
  Bhakoot, Rajju, Vedha, Gana — including cancellation/parihara paths.
- Tests: `apps/ai-service/tests/test_guna_milan.py` (718 LOC, 22 classes) +
  `test_guna_milan_vedic_audit.py` (664 LOC, 13 classes) — **120+ cases** covering every
  factor, all Mangal/Nadi/Bhakoot cancellation permutations, Rajju/Vedha detection,
  Mahendra & Stree-Deergha yogas, life-domain insights, remedies, boundary/edge pairs, and
  lookup-table integrity (27 nakshatras, 12 rashis).

**Confidence.** Determinism and factor/dosha presence verified by direct file read; coverage
established statically (test-file enumeration), **not** by executing `pytest` this pass (a
read-only reporting pass). PASS-0 records the suite's operator-verified runner count (452
ai-service tests) as green.

---

## Rule 11 — Reciprocal matching checks both sides before a profile surfaces → PASS

**What.** Every hard filter is bilateral: a candidate must satisfy the seeker's preferences
**and** the seeker must satisfy the candidate's, or it is dropped from the feed.

**Evidence.**
- `apps/api/src/matchmaking/engine.ts:697` → `applyHardFilters(userFilterProfile, candidateFilterProfiles, …)`
  → `filters.ts:91` filters candidates through `filters.ts:96` `passesAllFilters`, which chains
  **11 bilateral filters** (`:102-114`): gender, age, religion, distance, income, education,
  diet, caste, gotra, manglik, marital status.
- Directly verified both directions:
  - `passesGenderFilter` (`filters.ts:155`) returns `userWants.includes(candG) && candWants.includes(userG)`.
  - `passesAgeFilter` (`filters.ts:172`) returns `userFitsCandidate && candidateFitsUser` (`:164-170`).
  - `passesIncomeFilter` (`:299-305`) returns `userPrefVsCandIncome && candPrefVsUserIncome`.
- Blocks are bidirectional (both `blockerId` and `blockedId` directions queried, `engine.ts:560-574`);
  incognito / hide-from-search is intentionally one-way (safety).

**Note.** Filters are permissive when a field is undisclosed (e.g. gender missing on either
side → pass, `filters.ts:134`), matching how every optional preference behaves. That is a
deliberate "don't over-filter on missing data" choice, not a one-sided recommendation.

---

## Baseline note

This is a read-only reporting pass. It changes no source, generates no migration, and does
**not** move PASS-1's frozen test baseline (API 1388 · ai-service 452 · web 24 · mobile 208
· Playwright 7/23). All findings are static/structural except where a green suite is cited
from PASS-0.

## Cross-reference to fix work (deferred — do not action in an audit pass)

| ID | Sev | Finding | First place to look |
|---|---|---|---|
| A3-01 | **P1** | Presigned R2 URLs via `next/image` | `apps/web/src/components/ui/ImageWithFallback.client.tsx:51` (+ `next.config.ts:12-13`) |
| A3-02 | **P2** | Bare `throw new Error()` → opaque 500s | `apps/api/src/payments/dispute.ts` (14 sites); pattern to copy: `payments/subscriptions.ts:41` |
| A3-03 | **P2** | Unjustified `as unknown as` / `as any` | `apps/api/src/weddings/{coordinator,dayOf,expenses}.service.ts`; `apps/web/.../profile/complete/page.tsx:23` |
| A3-04 | OBS | `use client` ~49% ratio | per-component review needed |
| A3-05 | OBS | Rule 6 wording vs api reality | update `CLAUDE.md` rule text |
