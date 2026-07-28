# Smart Shaadi — Audit PASS 0: Ground-Truth Inventory

> **READ-ONLY pass. Nothing was fixed, no migration was generated, no schema was
> touched.** This document records what the code *actually* contains as of the
> date below — independent of what ROADMAP.md, CLAUDE.md, or the Phase 5–8
> kickoff docs claim. Where a doc and the code disagree, the code wins and the
> disagreement is logged in §6.

- **Date:** 2026-07-26
- **Branch:** `feat/virtual-date-lifecycle-hardening` (6 commits ahead of `main`; `main` == `origin/main`)
- **Repo:** `~/vivahOS` (native ext4 inside WSL `Ubuntu-24.04-New`)

## Method & confidence

| Section | How it was established | Confidence |
|---|---|---|
| §2 Route mounts | Direct: diffed every `export …Router` symbol in `apps/api/src/**` against every `.use(` mount. | **High** (exhaustive, self-run) |
| §4 Test counts | Static counts self-run; web + mobile executed this pass; api (**1388**) + ai-service (**452**) runner counts **operator-verified 2026-07-26**. | **High** — all four unit suites now have verified runner counts |
| §5 Migrations | Direct: read `_journal.json`, `meta/`, migration files, drift docs. Local DB ledger **not** re-confirmed live (Postgres `:5433` down; docker CLI absent in WSL). | High for file/journal; documented for DB ledger |
| §1 Features | 4 parallel evidence agents (per phase-group) returning file:line evidence, **reconciled + spot-checked** by the orchestrator. Surprising/contradictory claims re-verified directly. | Medium-High (agent-gathered, key claims re-verified) |
| §3 Pages | 1 evidence agent (nav config + sampled 18 of 188 pages). Sample, not exhaustive. | Medium (sampled) |
| §6 Contradictions | Synthesised from all of the above + direct doc reads. | High |

**Verdict legend (§1):**
- **BUILT** — real service + mounted route + tests exist.
- **BUILT (gated: FLAG)** — real implementation present, live behaviour switched by an env flag; the flag being OFF does *not* make it a shell.
- **PARTIAL** — real service + route, but no tests (or incomplete implementation).
- **MOCK-SHELL** — wired only to a mock/placeholder; no real backend behind it (live path is a `throw`/TODO).
- **SCAFFOLD-ONLY** — type/router/doc exists, no real implementation.
- **ABSENT / DEFERRED** — not in code.
- **EXTERNAL-BLOCKED** — not code-buildable; awaiting a partner/account (data or credentials).

---

## 1. Feature Inventory (Phases 1–8)

### Verdict tally

| Verdict | Count | Units |
|---|---|---|
| BUILT / BUILT-gated | ~48 | Nearly all of Phases 1–5, 6.1/6.4/6.5, 7.1–7.3, 8.1/8.1s/8.3a-c |
| PARTIAL | 2 | 4.i Audit logs (thin tests), 8.2 Post-marriage (no tests) |
| MOCK-SHELL | 3 | 6.2 Lending, 6.3 Insurance, 5.6 e-sign *provider send* (workflow itself is BUILT) |
| SCAFFOLD-ONLY | 2 | 4.n BetterStack (docs only), 8.3d Govt/DigiLocker-KYC (TODO stubs) |
| DEFERRED (ABSENT by design) | 1 | 7.4c Biometric login |
| CONFIG-ONLY / EXTERNAL-BLOCKED | 2 | 7.4a Store submission, 8.1-supply real venue partners |

**Headline:** the platform is far more built-out than a skim of the checklists suggests. The *engineering* surface for Phases 1–8 is real and mounted; what is genuinely not-real is narrow and well-bounded — two financial placement shells, the e-sign/KYC *provider* integrations, BetterStack wiring, real destination supply, and mobile store enrolment. All of those are either flag/credential-gated or partner-gated, not missing engineering.

### Phase 1 — Core Platform

| Unit | Actual status | Evidence (file:line) | Verdict |
|---|---|---|---|
| Auth (phone-OTP + session cookies + 2FA) | Real Better Auth config, OTP lockout service | `auth/config.ts` (362 LOC), `auth/otpLockout.ts:87`; tests `auth/__tests__/*` (~204 LOC) | **BUILT** |
| KYC (Aadhaar/PAN/liveness/face-match) | Real 10-method service incl. AWS Rekognition + duplicate/fraud checks; mock path when gated | `kyc/service.ts` (925 LOC), `kyc/rekognition.ts:113`, `kyc/duplicateCheck.ts:158`; tests ~1011 LOC | **BUILT (gated: KYC_LIVE / USE_MOCK_SERVICES)** |
| Profile (all sections, photos, R2) | Real profile/content/photos/family services; R2 presigned URLs | `profiles/service.ts` (499), `profiles/photos.service.ts` (R2 presign); tests ~2071 LOC | **BUILT (storage gated: R2_LIVE)** |
| Guna Milan (8 Ashtakoot) | Full deterministic Vedic math, all 8 factors + doshas | `apps/ai-service/src/services/guna_milan.py` (1055 LOC); tests `test_guna_milan.py` (80+) + `test_guna_milan_vedic_audit.py` | **BUILT** |
| Match feed (reciprocal + scoring) | Real engine + scorer + hard filters, reciprocal/block enforced | `matchmaking/engine.ts` (878), `scorer.ts` (418), `filters.ts` (393); tests ~1666 LOC | **BUILT** |
| Match requests (send/accept/block/report) | Real service, nested router | `matchmaking/requests/service.ts` (976), mounted `matchmaking/router.ts:298`; tests 711 LOC | **BUILT** |
| Real-time chat (Socket.io + Hi↔En translation) | Real socket handlers + HuggingFace Helsinki-NLP translate | `chat/socket/handlers.ts` (579), `ai-service/.../translate_service.py`; tests + `test_translate.py` | **BUILT** |
| Vendor discovery (listing/portfolio/booking) | Real service + portfolio + reviews + inquiries | `vendors/service.ts` (532) + siblings (~2748 LOC); tests ~1233 LOC | **BUILT** |
| Booking system (request→confirm→schedule→complete) | Full state machine | `bookings/service.ts` (806); tests 480 LOC | **BUILT** |
| Payments (Razorpay UPI/cards/wallets/EMI/subs) | Real SDK + mock stubs; 38 files, sub-routers | `payments/service.ts` (459), `lib/razorpay.ts:45`; tests ~1967 LOC | **BUILT (gated: RAZORPAY_LIVE / USE_MOCK_SERVICES)** |

### Phase 2 — Wedding & Event Planning

| Unit | Actual status | Evidence | Verdict |
|---|---|---|---|
| Wedding plan (date/venue/style/theme/couple-link) | Real object model (26 files, ~6325 LOC) | `weddings/service.ts` (1084); tests ~1166 LOC | **BUILT** |
| Budget tracker | Real expense/variance logic | `weddings/expenses.service.ts` (407) | **BUILT** |
| Task Kanban (auto-checklist) | Real task timeline/comments | `weddings/timeline.service.ts` (234) | **BUILT** |
| Guest list + RSVP (bulk import) | Real CSV import + RSVP | `guests/service.ts` (470), `guests/csvService.ts` | **BUILT** |
| Invitations (email + SMS) | Multi-channel via Bull → FCM/SES/MSG91 (service-only, no router) | `notifications/service.ts` (449), `providers/{ses,msg91,fcm}.ts` | **BUILT (gated: USE_MOCK_SERVICES)** |
| Rental booking | Full lifecycle state machine | `rentals/service.ts` (506); tests 571 LOC | **BUILT** |
| E-commerce store (cart + orders) | Real cart/checkout/promo | `store/order.service.ts` (618); tests ~1109 LOC | **BUILT** |
| Pre-wedding ceremonies (Haldi/Mehndi/Sangeet) | No separate module — modelled as events in weddings/extras + timeline | `weddings/extras.router.ts` (421) | **BUILT** (integrated, not standalone) |
| Video calls + meeting scheduler | Real Daily.co SDK + durable scheduling | `video/service.ts` (895), `lib/dailyco.ts` (111); tests 875 LOC | **BUILT (gated: VIDEO_LIVE)** |

### Phase 3 — AI Intelligence Layer

> Code contains **9** AI features, not the 7 in ROADMAP's Phase-3 table — it omits **FAQ** and **FII**, which exist and are tested (they appear in CLAUDE.md's production-state list).

| Unit | Evidence | Flag | Verdict |
|---|---|---|---|
| Conversation Coach | `coach_service.py` (364), router `coach.py:22`; `test_coach.py` (10) | `AI_FORCE_MOCK` | **BUILT** |
| Emotional Score (XLM-RoBERTa) | `emotional_service.py` + `sentiment_model.py`; `test_emotional.py` (14) | — | **BUILT** |
| Profile Optimizer | `profile_optimizer_service.py` (228); `test_profile_optimizer.py` (25) | — | **BUILT** |
| Guna Milan | `guna_milan.py` (1055); `test_guna_milan.py` (80+) | — | **BUILT** |
| Reputation Score | `reputation_service.py` (103) sklearn LogReg; `test_reputation.py` (12) | — | **BUILT** |
| DPI (Divorcee/Widow support) | `dpi_service.py` (319) CalibratedClassifierCV; `test_dpi.py` (18+) | `AI_FORCE_MOCK` | **BUILT** |
| Stay Quotient / Churn | `stay_service.py` + `stay_model.py`; sweep `churnRecoverySweepJob.ts`; `test_stay.py` (18+) | `RETENTION_OUTREACH_LIVE` | **BUILT (outreach gated)** |
| FAQ (gradient boosting) | `faq_service.py`; `test_faq.py` (17) | — | **BUILT** (not in ROADMAP Phase-3 table) |
| FII (7-signal + narrative) | `fii_service.py` (474); `test_fii.py` (12) | — | **BUILT** (not in ROADMAP Phase-3 table) |

### Phase 4 — Scale & Market Readiness

| Unit | Evidence | Verdict |
|---|---|---|
| Subscription tiers (Free/Standard/Premium) | `payments/subscriptions.ts` (367); `subscriptions.test.ts` (17) | **BUILT** |
| Razorpay Subscriptions | `lib/razorpay.ts:289-318` real+mock | **BUILT (gated: USE_MOCK_SERVICES)** |
| Feature gating per tier | `auth/requireTier.ts:45` middleware | **BUILT** |
| Hindi i18n (en+hi) | `apps/web/messages/{en,hi}.json` (~4991 keys each) | **BUILT** |
| Auto-SEO (22 routes) | `apps/web/src/lib/seo-data.ts` (6 communities + 10 cities + 6 castes) | **BUILT** |
| Structured data (JSON-LD) | `(public)/[slug]/page.tsx:128` `buildJsonLd()` | **BUILT** |
| Analytics dashboard | `analytics/analytics.router.ts` (7 endpoints); `analytics.service.test.ts` (15) | **BUILT** |
| GDPR (consent/delete/export) | `routes/gdpr.ts` (211); `gdpr.test.ts` (7) | **BUILT** |
| Immutable audit logs (chained-hash) | `kyc/audit.ts:52` + `admin/audit.router.ts`; verifier job exists but only ~4 tests | **PARTIAL** (functional; thin test coverage) |
| Referral program | `routes/referral.ts` (104) + ledger migration 0040; `referral.test.ts` (5) | **BUILT (gated: REFERRAL_LIVE)** |
| Sentry (api + web) | `lib/sentry.ts:52`, `sentry-redactor.ts`; `sentry-redactor.test.ts` | **BUILT** |
| PostHog (web) | `PostHogProvider.client.tsx:46` | **BUILT** |
| BetterStack uptime | **Docs only** (`docs/monitoring/betterstack-setup.md`); TODO placeholders `AdminHealthAndRisk.client.tsx:151,158` — no code integration | **SCAFFOLD-ONLY** (ROADMAP says "✅ Configured") |

### Phase 5 — Vendor Utilization Engine

| Unit | Evidence | Verdict |
|---|---|---|
| 5.1 Vendor Utilization Engine | `vendors/utilization.service.ts:98`; `utilization.service.test.ts` (26) | **BUILT** |
| 5.2 Calendar Intelligence | `calendar/router.ts:41-301` events+heatmap; `heatmap.test.ts` (10) | **BUILT** |
| 5.3 Vendor Gap Detection | `vendors/gap.service.ts:36`; `gap.service.test.ts` (11) | **BUILT** |
| 5.4 Dynamic Pricing | `pricing/service.ts` suggestPrice + `pricing_service.py`; `advisor.service.test.ts` (23) | **BUILT** |
| 5.5 B2B self-serve (contracts+invoicing) | `b2b/router.ts`+service, migration 0028; `b2b.test.ts` (29) | **BUILT** |
| 5.6 Docs/compliance + e-sign | Contract gen/templates/PDF/status **BUILT** + 17 tests (`documents.service.ts`), **but the live e-sign provider send is a TODO that throws** (`documents.service.ts:226`) and completion is a mock callback | **BUILT (workflow) / e-sign provider = MOCK-SHELL, gated: ESIGN_LIVE** |
| 5.7 Advanced analytics / forecasting | `analytics/analytics.service.ts`; `forecasting.test.ts` (38) | **BUILT** |

### Phase 6 — Financial & Growth

| Unit | Evidence | Verdict |
|---|---|---|
| 6.1 WhatsApp Business | `whatsapp/service.ts:36` real Bull queue + async worker; migration 0032; `whatsapp.service.test.ts` (8) | **BUILT (gated: WHATSAPP_LIVE)** |
| 6.2 NBFC lending referral | `lending/service.ts:38` **`MOCK_OFFERS` static array**; live branch throws (`service.ts:92`); `lending.service.test.ts` (11) | **MOCK-SHELL (gated: LENDING_LIVE)** |
| 6.3 Wedding insurance referral | `insurance/service.ts:36` **`MOCK_QUOTES` static array**; live branch throws (`service.ts:98`); `insurance.service.test.ts` (10) | **MOCK-SHELL (gated: INSURANCE_LIVE)** |
| 6.4 Auto-Marketing Engine | `marketing/service.ts` (828) full lifecycle; migration 0038; `engine.test.ts` (30) | **BUILT (kill-switch: MARKETING_AUTOMATION_ENABLED, default ON)** |
| 6.5 Multi-City Network | `cities/service.ts` (345), 10-city registry; migration 0038; `cities.test.ts` (22) | **BUILT** |

### Phase 7 — Mobile & International

| Unit | Evidence | Verdict |
|---|---|---|
| 7.1a RN + Expo scaffold | `apps/mobile/package.json` Expo ~57.0.7, RN 0.86.0, `@better-auth/expo` | **BUILT** |
| 7.1b Mobile design system | `apps/mobile/src/theme/tokens.ts` light/dark, 12 tokens | **BUILT** |
| 7.1c Feature parity (auth/profile/matches/messages) | ~38 screens under `apps/mobile/src/app/**` (auth, matches, chat, profile, vendors, bookings, billing, settings) | **BUILT** |
| 7.1d Mobile UI polish | component set + states + `services/push.ts` (FCM) | **BUILT** |
| 7.2 NRI / international matching | `profiles/nri.{router,service}.ts`, `lib/timezone.ts`, `lib/currency.ts`; feed-cache bust on opt-in | **BUILT (gated: NRI_MATCHING_LIVE)** |
| 7.3 Virtual Date System | `video/service.ts:249-330` lifecycle sweep + `jobs/virtualDateLifecycleJob.ts`; migration 0033; `service.test.ts` (875 LOC) | **BUILT** |
| 7.4a iOS/Android store submission | `eas.json` + `app.json` configured (owner `gulaabi-cleans-team`); signing on EAS | **CONFIG-ONLY / EXTERNAL-BLOCKED** (Apple/Google enrolment) |
| 7.4b Biometric re-entry gate | `apps/mobile/src/lib/biometric.ts` (220 LOC), login-regression guard `:184`; ~784 LOC tests | **BUILT** |
| 7.4c Biometric login (replace OTP) | Explicitly out of scope (`biometric.ts:8`) — OTP remains identity factor | **DEFERRED (ABSENT by design)** |

### Phase 8 — National Platform

| Unit | Evidence | Verdict |
|---|---|---|
| 8.1 Destination Wedding planning | `destinations/service.ts`+router, migration 0036, DB invariants (one-primary, date-window); `router.test.ts` (336 LOC) | **BUILT** |
| 8.1s Premium packages / destination supply | `packages/service.ts`; `is_placeholder` gates **only** `assertBookable()` (`:132-138`), never display/ranking; `placeholder-guard.test.ts` (227 LOC); migrations 0037/0039 | **BUILT (booking gated by is_placeholder)** |
| 8.1-supply Real venue partners | Seed rows only (`is_placeholder=true`, ~80 rows); no live partner ingestion | **EXTERNAL-BLOCKED** (venue partnerships) |
| 8.2 Post-marriage services | `post-marriage/service.ts` real (categories→partners→services, enquiry-only); **0 dedicated test files** | **PARTIAL** (real+mounted; no tests — fails the "BUILT requires tests" bar) |
| 8.3a National auto-scaling infra | `lib/circuit-breaker.ts`, `/metrics`, `/health`, `/ready`; `circuit-breaker.test.ts`, `metrics-histogram.test.ts` | **BUILT** |
| 8.3b PDF reporting | `reports/report-pdf.ts` + `lib/pdf/*`; `reports.test.ts` (167 LOC) | **BUILT** |
| 8.3c Handover docs | `docs/handover/*` populated | **BUILT** |
| 8.3d Government integration readiness | DigiLocker KYC path is TODO stubs (`kyc/aadhaar.ts:23,36`); returns mock refIds when gated | **SCAFFOLD-ONLY (gated: KYC_LIVE)** |

---

## 2. Route Mount Audit

**Result: every defined Express router in `apps/api/src/**` is mounted. Zero defined-but-unmounted routers (no dead-code / silently-missing feature at the routing layer).**

- Method: extracted all **86** router-symbol definitions (`export const …Router = Router()` / `export default router`) and diffed against every `.use(` mount across the tree.
- Mount points: `apps/api/src/index.ts` (main), plus nested `.use()` in `matchmaking/router.ts:298-299` (requests, shortlists) and `profiles/router.ts:286-303` (content, nri, horoscope, preferences, community, family, safety), plus `routes/_p3Register.ts:26-32` (assistant, vendor-engine, referral, vendor-leads, vendor-leads-admin, gdpr, family-mode).
- **Specifically confirmed wired** (candidates for "silently missing"): `nri.router.ts` → `/api/v1/profiles/me/nri`; all P3 routers via `registerP3Routes`; all 16 payments sub-routers; all 5 weddings sub-routers; destinations under `/api/v1/weddings/:weddingId/destinations`.
- **Note (comment drift, not a defect):** several routers carry stale header comments like `// Mount in index.ts: app.use(...)` or "UNMOUNTED" (b2b, documents, whatsapp, lending, insurance, retention, ai, video) — all are in fact mounted. Cosmetic only.
- Non-router `.use(` hits are middleware (`authenticate`, `authorize`, `checkReportsEnabled`, `requireInternalKey`, helmet, cors, cookieParser, rate-limit) — not features.

Two same-named symbols (`analyticsRouter` in both `analytics/analytics.router.ts` and `payments/analyticsRouter.ts`) coexist safely via the `forecastingRouter` import alias — no shadowing.

---

## 3. Page Inventory

- **188** `page.tsx` files under `apps/web/src/app/[locale]/**`. **Zero** Next.js `route.ts` API routes (consistent with the "Server Actions only, no Next API routes" rule).
- Route groups: `(app)`, `(auth)`, `(onboarding)`, `(marketing)`, `(legal)`, `(public)`, `(dev)`.
- **Navigation** is role-based via `nav-config.ts`, covering all 6 roles (INDIVIDUAL, VENDOR, ADMIN, SUPPORT, FAMILY_MEMBER, EVENT_COORDINATOR).

**Reachability** — the large majority of pages are linked from role-appropriate primary/secondary nav. Pages **not** in primary nav (reachable only by deep link) are mostly legitimate detail/hub routes: `/profiles/[profileId]`, `/settings` (hub → sub-pages), `/pricing` (from billing), `/welcome` (post-auth splash), `/admin/gaps`, `/admin/packages` (admin deep-links). **One genuine orphan feature:** `/assistant` — a fully-functional AI assistant chat with **no navigation entry point** anywhere.

**Real-data vs placeholder** (sampled 18 of 188): every sampled page fetches live data (server action / `@smartshaadi/api-client` / `fetch` to the API) — **no "coming soon", TODO, or hardcoded-shell pages found in the sample.** Critically, the ROADMAP-flagged placeholder-*supply* pages render **real seeded rows**, with `is_placeholder` gating only the booking CTA, not the listing:

| Page | Real data? | Evidence |
|---|---|---|
| `/packages` | Yes | `fetch(/api/v1/packages)` |
| `/services/post-marriage` | Yes | `fetch(/api/v1/post-marriage/services)` |
| `/services/lending` | Yes | `fetch(/api/v1/lending/offers)` (offers are mock — see §1 6.2) |
| `/services/insurance` | Yes | `fetch(/api/v1/insurance/quotes)` (quotes are mock — see §1 6.3) |
| `/nri` | Yes | `fetchAuth(/api/v1/matchmaking/feed?nriOnly=true)` |
| `/weddings/[id]/destinations` | Yes | `fetchAuth(/api/v1/weddings/{id}/destinations)` |
| `/assistant` | Yes (component) | `<AssistantChat/>` |

> Caveat: this is a **sample** (18/188), not an exhaustive per-page audit. A later pass should widen coverage, but the sampled signal is strongly "wired to real data."

---

## 4. Test Baseline

> **This is the regression signal for every later pass.** Web + mobile were executed during PASS 0; the **api (1388)** and **ai-service (452)** runner counts were **operator-verified 2026-07-26** (ai-service via its venv at `apps/ai-service/.venv`; `export NODE_OPTIONS=--max-old-space-size=12288` before any type-check). My earlier static greps (1366 api `it/test` blocks, 400 py `def test_`) were lower-bound proxies — the runner counts are authoritative. **If a later change moves any of these five numbers, state it explicitly.**

| Suite | Test files | Static cases | Runtime this pass | Last doc-claimed | Notes |
|---|---|---|---|---|---|
| **API** (vitest) | 132 | 1366 `it/test` (grep proxy) | **1388 verified** (operator, 2026-07-26) | 1241/1241 (§6b); 1255 (ROADMAP) | **1388** is the baseline; static grep under-counts (`.each`, multiline) |
| **AI-service** (pytest) | 21 | 400 `def test_` | **452 verified** (operator, 2026-07-26; venv `apps/ai-service/.venv`) | 278 (ROADMAP/CLAUDE — **stale/low**) | **452** is the baseline; parametrized cases expand beyond the `def` count |
| **Web unit** (vitest) | 4 | 24 | **24 passed / 24** ✅ | — | BudgetLendingCard 6, sentry-redactor 12, countries 4, useEntitlement 2 |
| **Mobile** (jest) | 32 suites | — | **208 passed / 208** ✅ | 165/165 (ROADMAP), 183/183 (CLAUDE) — **both stale/low** | Actual is 208; docs understate |
| **E2E** (Playwright) | 7 specs | 23 `test()` cases | not run (needs running app) | — | a11y 1, auth 4, demo 5, matching 2, onboarding 2, profile 5, roles 4 |

**Important:** the "21 E2E" (destinations) and "27/27 E2E" (Sprint J) figures in ROADMAP/kickoff docs are **not** the committed Playwright suite (which has no `destinations`/`marketing` specs) — they refer to ad-hoc authenticated **HTTP driver scripts** run during those sprints. The durable Playwright suite is 7 specs / 23 cases.

---

## 5. Migration State

> **SCHEMA FROZEN at migration file 0040 (operator directive, 2026-07-26). Do NOT run `drizzle-kit generate` / `db:generate` / `db:push`.** Journal drift is 0030–0040 (eleven untracked files).

**Drizzle journal high-water: idx 29 / `0029_pgvector_embedding`.** `meta/` snapshots run `0000_snapshot.json … 0029_snapshot.json` and stop.

**Committed `.sql` files run 0000 → 0040** (41 forward files; high-water file `0040_referral_credits_ledger.sql`), plus `rollback-*` and `sync-plans-*` helpers.

**→ The 0030/0031 drift is NOT "still as documented" — it has GROWN.** `docs/db/journal-drift.md` (written 2026-07-17) records only **0030 + 0031** as hand-written migrations outside the drizzle journal/snapshots. In reality **0030–0040 (11 files)** are all outside the journal:

| Untracked hand-written migration | Objects | In journal/snapshot? |
|---|---|---|
| 0030 pgvector_embedding_768 | pgvector 768-dim | ❌ |
| 0031 support_tickets | support_tickets, ticket_messages, ticket_events | ❌ |
| 0032 financial_shells | service_referrals, whatsapp_messages | ❌ |
| 0033 virtual_dates_retention | virtual_dates, retention_campaigns | ❌ |
| 0034 nri_international | 7 NRI columns + residency enum | ❌ |
| 0035 scale_indexes | 3 analytics indexes | ❌ |
| 0036 destination_wedding | wedding_destinations, guest_travel_legs | ❌ |
| 0037 phase8_supply_services | premium_packages, service_partners, post_marriage_services | ❌ |
| 0038 marketing_cities_registry | marketing_campaigns/content/sends, cities | ❌ |
| 0039 supply_city_registry_link | supply↔city FKs | ❌ |
| 0040 referral_credits_ledger | referral credits ledger | ❌ |

**Ledger state (from docs, not re-confirmed live this pass):**
- **Local** docker DB `drizzle.__drizzle_migrations`: documented at **30 rows (0000–0029)** in `journal-drift.md`. The 0030+ files are applied to local via psql out-of-band (per the CI note in CLAUDE.md). *Not re-confirmed this pass — local Postgres `:5433` is down and the docker CLI is not exposed inside this WSL distro.*
- **Prod**: reconciled **2026-06-07** (`scripts/db/reconcile-drift-2026-06-07.sql`) — table was entirely absent on prod, then baseline-seeded all 30 migrations (0000–0029) with real `sha256(file)` hashes; 0030+ applied via psql out-of-band. See `docs/MIGRATIONS-PENDING.md`.

**The hazard is unchanged and now larger:** the next `drizzle-kit generate` will diff `schema/*.ts` against the 0029 snapshot, **re-emit all 0030–0040 objects**, and number the new file `0030_*`, colliding with the existing hand-written `0030`. Per `journal-drift.md`: do **not** run `db:generate`/`db:push` until this is reconciled (operator-supervised).

---

## 6. Documentation Contradictions (doc claims the code contradicts)

| # | Doc claim | Code reality | Type |
|---|---|---|---|
| 1 | `journal-drift.md`: only **0030/0031** are untracked hand-written migrations | **0030–0040 (11 files)** are untracked; the doc is stale (predates 0032–0040) | Stale, understated drift |
| 2 | Kickoff doc §0.0/§1: migration high-water **0036** | File high-water is **0040** (0037–0040 added after the doc) | Stale |
| 3 | Kickoff doc §0.0/§5b: "local `main` ~54 commits ahead of `origin/main`; Sprint I **NOT pushed**" | `main` == `origin/main` (0 ahead / 0 behind) — already pushed | Stale (resolved) |
| 4 | ROADMAP "What's NOT Here": **PWA** deferred/"works in browser as-is" | ROADMAP's own 2026-07-19 session entry says **PWA shipped** (manifest + allowlist service worker + offline shell) | Internal self-contradiction |
| 5 | ROADMAP Phase 4: **BetterStack ✅ Configured** | Docs only; no code; TODO placeholders in `AdminHealthAndRisk.client.tsx:151,158` | Overstated (SCAFFOLD-ONLY) |
| 6 | ROADMAP Phase 6: Lending/Insurance "🟡 **Built**, gated" | **MOCK-SHELL** — `MOCK_OFFERS`/`MOCK_QUOTES` static arrays, live path throws. (Kickoff doc is accurate: "mock only placement shell") | Overstated in ROADMAP |
| 7 | ROADMAP: mobile "jest 17/17" / "165/165"; CLAUDE "183/183" | Actual **208/208** | Stale counts |
| 8 | ai-service "**278 pytest**" (ROADMAP/CLAUDE) | **452** tests actually run (21 files, operator-verified 2026-07-26) — claim badly stale | Stale count |
| 9 | ROADMAP Phase 8.2 Post-marriage "✅ Built" | Real service but **0 test files** → PARTIAL by the audit bar | Tests missing |
| 10 | CLAUDE.md "Phase 1 — Active Modules" checklist: every item `[ ]` **unchecked** | Phase 1 is fully shipped/BUILT | Stale checklist |
| 11 | Kickoff doc §1 (self-documented as RESOLVED): original "migration 0028 merged / **218-row** calendar seed" | Never 218 — calendar seed is 56 muhurats (2026) / ~190 `calendar_events` rows (reconcile note); doc already flags this as a wrong earlier claim | Historical (self-corrected) |
| 12 | Several router files: header comment "**UNMOUNTED** / Mount in index.ts" | All are mounted (see §2) | Stale code comments |

**On the audit brief's framing:** the brief states "ROADMAP.md shows all Phase 5–8 boxes unchecked." The *current* ROADMAP.md actually marks Phases 5–8 as **✅ SHIPPED** with per-unit ✅/🟡/🔴 markers (no `[ ]` checkboxes in those sections). The only all-`[ ]`-unchecked list is CLAUDE.md's "Phase 1 — Active Modules" (item 10 above). If the brief was describing a prior ROADMAP revision, that state is not what's on disk today.

---

## Appendix — What a later pass still needs to nail down

1. ~~Run api + ai-service suites~~ — **DONE (operator-verified 2026-07-26): API 1388, ai-service 452.** These + web 24 / mobile 208 / Playwright 7 specs·23 cases are the frozen regression baseline. Reproduce: activate `apps/ai-service/.venv` for pytest; `export NODE_OPTIONS=--max-old-space-size=12288` before type-check.
2. **Live-confirm the local & prod migration ledgers** (`SELECT count(*) FROM drizzle.__drizzle_migrations`) and presence of 0032–0040 objects — could not be done this pass (Docker Desktop off / local Postgres `:5433` down).
3. **Widen the page-data sample** beyond 18/188 (esp. admin + vendor deep routes) to confirm "no placeholder pages" holds platform-wide.
4. **Reconcile the drizzle journal drift** (0030–0040) before any `db:generate` — operator-supervised, per `journal-drift.md`.
5. Decide whether MOCK-SHELL units (6.2 lending, 6.3 insurance, 5.6 e-sign provider, 8.3d DigiLocker-KYC) and the `/assistant` orphan should be surfaced/flagged in the launch checklist.
