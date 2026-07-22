# Smart Shaadi — Roadmap

> **Update this file at the end of every development session.**
> Claude Code reads this to understand current progress and next targets.

---

## Current Status

```
Phase:    8 (shipped — launch staging)
Status:   Phases 1–8 complete. Awaiting operator deploy decision.
Blocker:  External: Razorpay live account, MSG91 DLT approval, DigiLocker partnership, 
          legal sign-off. Engineering: staging SLO calibration (real traffic needed).
Features: 80 placeholder supply rows + fictional venue details (is_placeholder=true) 
          block booking/payment until partner onboarding swaps them to real.
Last updated: 2026-07-19
```

---

## The Phases: What's Built, What's Gated, What's Waiting

### Phase 1 — Core Platform ✅ SHIPPED

**Status:** All 10 core modules live. Verified in production 2026-05-20 by PHASE-1-4-AUDIT.md (143 items audited, 105 shipped, 29 partial, 9 missing — all non-blocking).

| Unit | Status | Evidence |
|------|--------|----------|
| Authentication (phone OTP + session cookies + 2FA) | ✅ Built | commit `221cbbe` + `apps/api/src/auth/config.ts` |
| KYC (Aadhaar / PAN / liveness / face match) | 🟡 Built, gated: `KYC_LIVE=false` | `apps/api/src/lib/env.ts:46-51` · mock verification stubs safe for demo |
| Profile (all sections, photos, R2 storage) | ✅ Built | `apps/api/src/profiles/*` + `apps/web/src/app/[locale]/(onboarding)/profile/*` |
| Guna Milan (all 8 Ashtakoot factors) | ✅ Built + tested (105 pytest cases) | `apps/ai-service/src/routers/horoscope.py` |
| Match feed (reciprocal filtering + scoring) | ✅ Built + cached | `apps/api/src/matchmaking/engine.ts` |
| Match requests (send/accept/block/report) | ✅ Built | `apps/api/src/matchmaking/requests/*` |
| Real-time chat (Socket.io + Hindi↔English translation) | ✅ Built | `apps/api/src/chat/*` · `apps/web/src/app/[locale]/(app)/chats/*` |
| Vendor discovery (listing + portfolio + booking) | ✅ Built | `apps/api/src/vendors/*` · `apps/web/src/app/[locale]/(app)/vendors/*` |
| Booking system (request → confirm → schedule → complete) | ✅ Built | `apps/api/src/bookings/*` |
| Payments (Razorpay + UPI + cards + wallets + EMI + subscriptions) | 🟡 Built, using mock: `USE_MOCK_SERVICES=true` | All real hooks in place; live activation requires Razorpay merchant account |

**Blockers to real traffic:**
- MSG91 DLT (OTP sender registration) — regulatory, Colonel's side, ~2–4 weeks
- Razorpay live account + KYC — Colonel's side, ~1 week
- DigiLocker partnership — regulatory, ~2–3 months

---

### Phase 2 — Wedding & Event Planning ✅ SHIPPED

**Status:** Full wedding planner. Phase 1-4 completeness audit (2026-05-20) scored this 10/10.

| Unit | Status | Evidence |
|------|--------|----------|
| Wedding plan (date, venue, style, theme, couple link) | ✅ Built | `apps/api/src/weddings/*` · migration 0001 |
| Budget tracker (by category with calculations) | ✅ Built | `apps/api/src/weddings/service.ts` |
| Task Kanban (auto-checklist from wedding date) | ✅ Built | `apps/web/src/app/[locale]/(app)/weddings/[id]/tasks` |
| Guest list + RSVP (manual + bulk import, meal prefs) | ✅ Built | `apps/api/src/guests/*` · `apps/web/src/app/[locale]/(app)/weddings/[id]/guests` |
| Invitations (email + SMS mocked; AWS SES + MSG91 when live) | ✅ Built | `apps/api/src/notifications/*` |
| Rental booking (decor, costumes, AV) | ✅ Built | `apps/api/src/rentals/*` |
| E-Commerce store (vendor products, shopping cart, orders) | ✅ Built | `apps/api/src/store/*` |
| Pre-wedding ceremonies (Haldi, Mehndi, Sangeet) | ✅ Built | `apps/web/src/app/[locale]/(app)/weddings/[id]/ceremonies` · ceremony scheduling in wedding planner |
| Video calls + meeting scheduler | 🟡 Built, mocked: `VIDEO_LIVE=false` | `apps/api/src/lib/dailyco.ts` · Daily.co integration ready with `VIDEO_LIVE=true` + credentials |

---

### Phase 3 — AI Intelligence Layer ✅ SHIPPED

**Status:** 6 production AI features live (commit `bcec628` and earlier). Validated via 278 pytest tests.

| Feature | Status | Evidence |
|---------|--------|----------|
| Conversation Coach (profile interest extraction, chat suggestions) | ✅ Built | `apps/ai-service/src/services/coach_service.py` · uses Gemini (LLM_PROVIDER=gemini) |
| Emotional Compatibility Score (sentiment analysis via HuggingFace XLM-RoBERTa) | ✅ Built | `apps/ai-service/src/services/sentiment_model.py` |
| Profile Optimizer (photo quality + bio scoring) | ✅ Built | `apps/ai-service/src/services/profile_optimizer_service.py` |
| Guna Milan (all 8 Ashtakoot factors, deterministic) | ✅ Built | `apps/ai-service/src/routers/horoscope.py` · 105 test cases pass |
| Reputation Score (response rate, consistency) | ✅ Built | `apps/ai-service/src/services/reputation_service.py` |
| DPI (Divorcee & Widow Support Mode, visibility controls) | ✅ Built | `apps/api/src/profiles/service.ts` · `apps/ai-service/src/services/dpi_service.py` |
| Churn detection & Stay Quotient (risk classification + win-back outreach) | ✅ Built, gated: `RETENTION_OUTREACH_LIVE=false` | `apps/ai-service/src/services/stay_service.py` · flag in `apps/api/src/lib/env.ts:73` |

**External gate:** None. All 6 features functional; churn outreach mocked by flag.

---

### Phase 4 — Scale & Market Readiness ✅ SHIPPED

**Status:** Subscriptions, SEO, monitoring, docs all built. Launch checklist green.

| Unit | Status | Evidence |
|------|--------|----------|
| Subscription tiers (Free, Standard M/Y, Premium M/Y) | ✅ Built | `apps/api/src/payments/subscriptions.ts` · 4 plans seeded |
| Razorpay Subscriptions integration | 🟡 Built, mock plans: `mock_plan_standard_monthly` etc. | Live: update env `RAZORPAY_PLAN_*` IDs after Razorpay onboarding |
| Feature gating per tier | ✅ Built | `apps/api/src/auth/requireTier.ts` |
| Hindi language support (en + hi i18n throughout) | ✅ Built | `apps/web/messages/` (en, hi) · all pages bilingual |
| Auto-SEO (LLM-generated community × city pages) | ✅ Built | `apps/web/src/lib/seo-data.ts` · 22 programmatic routes registered |
| Structured data markup (Google rich results) | ✅ Built | Next.js metadata API + JSON-LD schema |
| Analytics dashboard (growth, conversion, revenue, churn) | ✅ Built | `apps/api/src/analytics/analytics.router.ts` · `apps/web/src/app/[locale]/(app)/admin/analytics` |
| GDPR controls (consent, deletion, export, portability) | ✅ Built | `apps/api/src/users/router.ts` · `/api/v1/users/me/export`, `/api/v1/users/me/delete` |
| Immutable audit logs | ✅ Built | `apps/api/src/kyc/audit.ts` + `apps/api/src/admin/audit.router.ts` · chained-hash per escrow/KYC/payment |
| Referral program | 🟡 Built, flagged: `REFERRAL_LIVE=false` (not shown in env.ts, needs wiring) | Scaffold exists; awaiting product decision |
| Sentry monitoring | ✅ Built | API + web; `SENTRY_DSN` in env; source-map upload in CI |
| PostHog analytics | ✅ Built | Event tracking instrumented across web |
| BetterStack uptime monitors | ✅ Configured | Docs in `docs/monitoring/betterstack-setup.md` |

---

### Phase 5 — Vendor Utilization Engine ✅ SHIPPED

**Status:** Sprint A–B complete (commit `f46e826` · `f7bde4f`). Vendor gap detection, dynamic pricing, calendar intelligence live.

| Unit | Status | Evidence |
|------|--------|----------|
| Vendor Utilization Engine (wedding → off-season routing) | ✅ Built | `apps/api/src/vendors/utilization.ts` · migration 0028 |
| Vendor Gap Detection (city-level category alerts) | ✅ Built | `apps/api/src/vendors/gap.ts` · gap service + admin router |
| Calendar Intelligence (muhurat, government, festival, school) | ✅ Built | `apps/api/src/calendar/*` · deterministic date rules |
| Dynamic Pricing (muhurat premium, off-season discounts) | ✅ Built | `apps/ai-service/src/services/pricing_service.py` · ADR-001 pricing advisor pattern |
| B2B Self-Serve (corporate registration, event catalogue, invoiced bookings) | ✅ Built | `apps/api/src/b2b/*` · corporate vendor flow |
| Documentation & Compliance (e-sign, contract templates) | 🟡 Built, gated: `ESIGN_LIVE=false` | `apps/api/src/documents/*` · DigiLocker/Signzy mocked; activate with `ESIGN_LIVE=true` + credentials |
| Advanced analytics & demand forecasting | ✅ Built | `apps/api/src/analytics/analytics.service.ts` · SVG reporting in admin analytics |

---

### Phase 6 — Financial & Growth ✅ SHIPPED

**Status:** Sprint D + Sprint J complete. Auto-marketing engine (6.4) and multi-city network (6.5) both shipped and seeded.

| Unit | Status | Evidence |
|------|--------|----------|
| NBFC lending (loan referral, EMI calculator) | 🟡 Built, gated: `LENDING_LIVE=false` | Razorpay EMI already live in payments |
| Wedding insurance referral | 🟡 Built, gated: `INSURANCE_LIVE=false` | Mock shell waiting for partner integration |
| Auto-Marketing Engine | ✅ Built + seeded (6.4, migration 0038) | 5 SQL segments, Gemini copy generation, per-language approval gate, weekly sweeps, consent-gated dispatch, Redis frequency cap, `/admin/marketing` dashboard. **Live**: control with `MARKETING_AUTOMATION_ENABLED=true` (default ON) |
| Multi-City Network (cities registry, vendor network) | ✅ Built + seeded (6.5, migration 0038) | 10 reference cities seeded, vendor city_id backfilled, `/admin/cities` ops dashboard, `/api/v1/cities` public endpoint. Expansion lifecycle: ACTIVE/EXPANSION/PLANNED |
| WhatsApp Business API integration | 🟡 Built, gated: `WHATSAPP_LIVE=false` | `apps/api/src/whatsapp/*` · mocked; activate with `WHATSAPP_LIVE=true` + Cloud API credentials |

---

### Phase 7 — Mobile & International ✅ SHIPPED (with caveats)

**Status:** Mobile scaffold + Phase 1 feature parity complete (as of 2026-07-19). UI Polish awaiting review.

| Unit | Status | Evidence |
|------|--------|----------|
| React Native + Expo mobile app scaffold | ✅ Built | `apps/mobile` (Expo SDK 57, RN 0.86, Expo Router, NativeWind) · phone-OTP cookie auth via `@better-auth/expo` |
| Mobile design system (light/dark theming, tokens, primitives) | ✅ Built | `apps/mobile/src/theme/` · Button/Input/Screen/Card/OTPInput + animations |
| Mobile feature parity (auth, profile, matches, messages) | ✅ Built | Phase 0+1 complete on 2026-07-18 (commit `35a6c76`). Type-check, jest 17/17, Android bundle export all green. |
| Mobile UI Polish (Playfair headings, responsive 375px, a11y, haptics) | ✅ Built (branch `feat/mobile-ui-polish`) | 15 hardcoded hex removed, jest-expo + RNTL migrated, segmented OTP auto-submit, pull-to-refresh, keyboard avoidance. **Status:** pushed, awaiting operator merge to main |
| NRI & international matching (country filters, time zone scheduling) | ✅ Built, gated: `NRI_MATCHING_LIVE=false` | Migration 0034 · `apps/api/src/profiles/nri.router.ts` + `apps/api/src/profiles/nri.service.ts` |
| Virtual Date System (durable scheduling, T-24h/T-15m reminders, icebreakers) | ⏳ Built (Sprint F) | Migration 0033 — feature architecture exists; post-date feedback ready |
| iOS/Android store submission | ⬜ Not built | Blocked: Apple Developer Program + Google Play Console enrollment (Colonel's side, ~6 weeks) + real on-device testing |
| Biometric login | ⬜ Not built | Deferred post-store-submission (Phase 7.4) |

---

### Phase 8 — National Platform ✅ SHIPPED

**Status:** Sprints A–I complete (migrations 0027–0036). Destination wedding planning live with placeholder supply.

| Unit | Status | Evidence |
|------|--------|----------|
| Destination Wedding planning (multi-city legs, ceremonies, guest travel) | ✅ Built (Sprint I, unit 8.1, migration 0036) | `apps/api/src/destinations/*` · `/api/v1/weddings/:id/destinations` · `apps/web/src/app/[locale]/(app)/weddings/[id]/destinations` UI with en+hi · 21 E2E tests · browser-verified 375px+1440px |
| Destination Wedding premium packages | 🟡 Built, **placeholder supply** (80 rows, `is_placeholder=true`) | Tier-3 deviation: packages real-functional but cannot be booked until partners onboard and flip `is_placeholder=false` · `UPDATE vendors/premium_packages SET is_placeholder=false` activates each real venue |
| Destination Wedding supply (real venue partners, photographers, logistics) | 🔴 **Blocked** | External: venue partnerships (Rajasthan, Goa, Himachal) + logistics partners (travel, accommodation). Not code-buildable; awaiting Colonel's partnership agreements (~3 months) |
| Post-marriage services (honeymoon, anniversary, referral) | 🟡 Built, **placeholder supply** | Tier-3 unit: `service_partners` table seeded with fictional services, `is_placeholder=true` · real services booked after partner agreements |
| National auto-scaling infrastructure (k6 suite, circuit breakers, queue concurrency) | ✅ Built | Sprint H (migration 0035) · k6 baseline measured 2026-07-19 (vendors, feed, analytics all green; auth unmeasurable from loopback) · `/metrics` Prometheus endpoint · `/ready` readiness probe with 2s timeouts |
| PDF reporting (vendors, couples, admin) | ✅ Built | `apps/api/src/lib/pdf/*` + `apps/api/src/reports/*` + `apps/api/src/b2b/invoice-pdf.ts` + `apps/api/src/documents/contract-pdf.ts` · `/api/v1/reports/*` endpoints |
| Project handover documentation | ✅ Built | `docs/handover/` directory (HANDOVER-INDEX, SCALING-PLAYBOOK, INDEX-PLAN, SLO-AND-ALERTING, ENV-MATRIX) |
| Government integration readiness | 🟡 Partial | Digilocker e-sign framework in place (mocked, activate with `ESIGN_LIVE=true` + creds); Government ID shells present but not production-tested |

---

## Feature Flags (Off by Default, Activate in Production)

Every feature below is **live in code** but **gated OFF** by environment variable. Activating is as simple as `env_var=true` + credentials (if needed).

| Flag | Gate | Default | Required credentials | Activate when |
|------|------|---------|----------------------|---|
| `KYC_LIVE` | All KYC (Aadhaar, liveness, face match) | `false` | DigiLocker OAuth, AWS Rekognition | Colonel's KYC provider onboarding complete |
| `ESIGN_LIVE` | Contract signing (e-sign, document workflow) | `false` | DigiLocker + Signzy | Legal review + partner agreement signed |
| `RETENTION_OUTREACH_LIVE` | Churn sweep, win-back marketing | `false` | none (uses Gemini) | After launch calibration period (Week 2–4) |
| `NRI_MATCHING_LIVE` | International matching, time zone scheduling | `false` | none | After launch validation in key markets |
| `WHATSAPP_LIVE` | WhatsApp Business API notifications | `false` | WhatsApp Cloud API creds + verified phone | Phase 7 distribution boost |
| `LENDING_LIVE` | NBFC lending placement (loan referral) | `false` | NBFC partner API key | Financial services partnerships (Phase 6 expansion) |
| `INSURANCE_LIVE` | Wedding insurance referral | `false` | Insurance partner API key | Insurance partnerships (Phase 6 expansion) |
| `VIDEO_LIVE` | Daily.co video calls (currently all mocked) | `false` | Daily.co API key | Immediate (ready; Colonel's side) |
| `MARKETING_AUTOMATION_ENABLED` | Auto-marketing engine (segments, Gemini content, sweeps) | `true` | Gemini API (already set) | Live (already ON; turn OFF if sweep paused) |
| `R2_LIVE` | Cloudflare R2 file storage (currently mocked) | `false` | R2 account ID + access key | Immediate (ready; Colonel's side) |
| `MONGO_LIVE` | MongoDB persistence for ProfileContent | `false` | MongoDB Atlas URI | Immediate (ready; Colonel's side) |
| `RAZORPAY_LIVE` | Razorpay payments (currently mocked) | `false` | Razorpay live merchant key + secret | Colonel's Razorpay account approved |

---

## What Remains Blocked

| Item | Status | Owner | Blocker | ETA |
|------|--------|-------|---------|-----|
| **Razorpay live account** (payments, subscriptions) | 🔴 Blocked | Colonel | Merchant onboarding + KYC + account activation | ~1 week |
| **MSG91 DLT registration** (OTP sender, SMS) | 🔴 Blocked | Colonel | Government template approval + DLT registration | ~2–4 weeks |
| **DigiLocker partnership** (KYC, e-sign) | 🔴 Blocked | Colonel | Partnership agreement + API credentials | ~2–3 months |
| **Apple App Store + Google Play** (mobile store submission) | 🔴 Blocked | Colonel | Developer Program enrollment + review | ~6 weeks per store |
| **Staging SLO calibration** (real traffic measurement) | 🔴 Blocked | Engineering | Need staging environment with real load | Post-launch (Week 1–4) |
| **Destination wedding venue partners** (80 placeholder rows) | 🔴 Blocked | Colonel | Venue partnership agreements (Rajasthan, Goa, etc.) | ~3 months |
| **Real supply seed** (photographers, logistics, florists) | 🔴 Blocked | Colonel | Vendor partnerships in 5+ cities | ~2 months |
| **Production penetration test** (OWASP ASVS Level 2) | 🟡 Scheduled | Engineering | Post-launch (Week 2–4) | ~2 weeks |

---

## Recent Session History

### 2026-07-22 (current) — Premium UI follow-ups: phase-6 tail cleared

Merged PR #7 (phase 6) to main, then cleared all four documented follow-ups on
`feat/premium-ui-followups`: (1) OnboardingStepper fully i18n'd (async server
component, `vendorRole.onboarding.stepper.*`, browser-verified en+hi);
(2) vendor dashboards browser-exercised with a real VENDOR session (qa-ven-01 +
seeded leads/payouts/reviews rows in local dev) — found and fixed three
data-only bugs: payouts `₹NaN` stats (web/API field-name drift
`pending`→`pendingAmount`), raw `eventType` enum on lead rows (label map; added
TILAK/SAGAN keys, fixed hi ENGAGEMENT "सगुन"→"सगाई"), and a 100%-hardcoded
VendorReviewReply widget; (3) packages/post-marriage skeletons consolidated
onto RouteSkeleton `mediaGrid`/`iconGrid` presets; (4) DB-seeded plan
names/features localized via `apps/web/src/lib/plan-i18n.ts` (code/literal
keyed, DB-string fallback) on pricing + billing + confirm, plus billing's stray
English literals and 'en-IN' formatting. Debug find: a stale `sw.js` service
worker served old client chunks — looked exactly like stale HMR, survived
dev-server restart and `.next` wipe; fix is unregister SW + clear CacheStorage.
Verification: forced type-check/lint 11/11, tests green, prod build green,
Playwright 375px en+hi across 10+ views, zero console errors.
See docs/premium-ui/phase6-summary.md (backlog section).

### 2026-07-21/22 — Premium UI Phase 6: straggler-route sweep

Cleared the phase-5 follow-up backlog on `feat/premium-ui-phase-6` with 5 Opus
teammates in one wave + orchestrator repairs. Areas: pricing (fallback plans,
interval labels, CTAs, footer — all i18n'd), welcome (entire page was hardcoded;
new namespace incl. generateMetadata), likes/shortlist/viewers (verified badges →
StatusChip, fallback names, timeAgo descriptors, photo alt text, EmptyState
overrides — viewers' bare `no-network` preset was rendering "Couldn't load this
page" for an empty list), documents (status badges → StatusChip via literal-key
map), profiles (joinedRelative ICU plurals via discriminated union, memberSince
locale-aware), vendor dashboards (leads/payouts/insights/reviews/pipeline — payouts
+ insights namespaces created from zero, 2 status Records → StatusChip, ~62 keys),
vendor onboarding forms (5 client forms + category/eventType/unit label maps, ~81
keys), services insurance/lending + onboarding services page ('en-IN' → locale
mapping; lending "कार्यकाल"→"अवधि" fix + tenureMonths key). Orchestrator caught:
T-A's next-intl `defaultValue` misuse (missing-key render) and non-throwing t()
try/catch probing (would print raw keys as features), template-literal t() keys in
3 teammates' output, T-B hardcoding 'hi-IN' for all users, T-D leaving pipeline
EmptyState titles hardcoded, T-C's TS errors it reported as pre-existing.
213 en+hi key pairs via 5 fragments; browser-verified at 375px in en+hi across 13
views; type-check/lint/build green (forced). See docs/premium-ui/phase6-summary.md.

### 2026-07-21 — Premium UI Phase 5: full UX backlog + never-audited long tail

Completed the entire tracked premium-UI backlog on `feat/premium-ui-phase-5` (PR #6)
with 7 Opus teammates in two waves. UX candidates: chat photo-upload optimistic
spinner (+`photoLoading` on ChatMessage), voice-player error/retry, reaction-picker
keyboard nav, framer-motion typing dots, checkout mobile sticky summary + full i18n,
store filter i18n, 5 typed marketplace analytics events, onboarding confetti
(framer-motion — canvas-confetti rejected after `pnpm add` churned better-auth peer
deps in the lockfile), seating "seats" literal. Never-audited areas i18n'd + chipped:
family (~135 keys), support (~40), notifications+assistant (~44), coordinator,
calendar (fixed hardcoded 'en-IN' heatmap locale bug — Hindi months now render), b2b.
Also fixed: "दहेज" (dowry!) as the Trousseau store category label, i18next-style
plural keys, raw-HTML-in-message INVALID_TAG crash, duplicate optimistic photo
bubbles, phantom StatusChip claims, English EmptyState presets leaking into hi.
~250 en+hi key pairs via 7 fragments; browser-verified at 375px in en+hi across 11
areas; type-check/build/lint green. Follow-up backlog documented in
`docs/premium-ui/phase5-summary.md` (pricing/services/packages/vendor/documents/…).

### 2026-07-21 — Ship premium UI + Phase 4: shared components, payments audit, i18n completion, CI green

Shipped `feat/premium-ui-phase-1` (PR #4): pushed 14 accumulated commits, then
fixed every CI failure the first-ever complete pipeline run surfaced — demo-DB
signal checks gated behind `DEMO_DB_CHECKS=1`, promptfoo upgraded to pinned
0.121.19 with per-provider split configs (`evals/promptfooconfig.{ml,llm}.yaml`
— 0.107.7 crashed on fresh installs), `vitest.setup.ts` no longer clobbers CI's
`DATABASE_URL`, hand-written migrations 0030+ now applied in CI via psql, mobile
jest timeout 15s, timezone.ts midnight h24 bug (`hourCycle: 'h23'`), guna suite
env-pinned, E2E job repaired (playwright binary path + warn-first skip without
`VERCEL_PREVIEW_URL`). Phase-4 work on `feat/premium-ui-phase-4` via 7 teammates:
shared `StatusChip` + admin skeleton presets + `no-products` EmptyState + rating
badge; StatusChip rollout across ~20 status-mapping sites; 16 layout-matched
admin `loading.tsx`; first `/payments` audit (full i18n, was zero keys);
onboarding personal/career/lifestyle + RequestsClient (886 lines) + weddings
seating/moodboard/registry/invite i18n; 6 more mounted-guard hydration fixes;
~680 en+hi keys merged. Hindi visual pass at 375px across 9 areas (fixed admin
hub overflow via `min-w-0`, one transliteration). Teammate damage caught by
orchestrator verification: smart-quote mangling, `t`/`table` shadowing, 3 type
errors, an orphan duplicate component.

### 2026-07-21 — Docs audit & reorganization

Full `docs/` audit (124 files): archived 46 historical artifacts (weekly smoke
tests, 24 superpowers plans, old demo scripts, client-era docs, day notes) into
`docs/archive/`, moved KYC-PROVIDERS into `PROVIDER-ACTIVATION/kyc-providers.md`,
deleted 2.2 MB of stale screenshots, added `docs/README.md` navigation index.
All load-bearing paths kept in place; repo-wide doc-link check clean. Commit `c8a287a`.

### 2026-07-20 — Premium UI Phase 3: five-area teammate sweep + real QA portraits

Five parallel Opus teammates (chat interior, weddings, marketplace, onboarding,
admin) with strict disjoint file scopes + orchestrator verification. Commits
`c35ae2b`…`04f0f33`.

- **QA portraits:** 22 real portrait photos (12M/10F, hand-classified from a
  70-image pool) rendered to 44 4:5 crops, installed in local mock-R2 and
  verified live. Production steps STAGED but not executed (classifier blocks
  agent access to prod creds): operator must run
  `apps/api/.data/upload-qa-photos.mjs` (R2 upload) and
  `audit/prod-qa-photos.sql` (33-row key fix; rollback file alongside).
- **Teammate output verified, 5 defects caught by orchestrator:** vendor-detail
  template literals mangled to TS1127 garbage by the shell boundary; Metadata
  imported from 'react'; phantom PageProps in bookings metadata; plus two more
  instances of the UTC-vs-IST timestamp hydration bug (KycQueueTable,
  MessageBubble) — same class as the /chats one from Phase 2.
- **Shipped per area:** chat (44px voice/reaction/header targets, composer
  polish, i18n for presence/menu/empty states); weddings (i18n across
  hub/budget/tasks/guests/day-of + GuestTable, localised day-of metadata);
  marketplace (metadata for vendors/store/product/rentals/bookings, gold star
  tokens, en+hi string foundation); onboarding (photos step unified onto
  OnboardingNav, horoscope fieldset grouping, richer loading/error states);
  admin (metadata on 13 routes, KYC queue touch targets, row hover, stat-card
  lift).
- **Verification:** ~700 new i18n keys merged additively (en+hi), cold
  type-check 11/11, prod build green, browser passes over wedding hub/guests,
  vendors list+detail, store, admin hub/KYC, onboarding photos, chat thread —
  zero console errors, no 360px horizontal scroll.

### 2026-07-20 (current) — Premium UI Phase 2: core matchmaking journey

Live Playwright audit (375px + 1280px, QA user) of dashboard / feed / profile
detail / chats / chat thread / matches / requests / likes / shortlist — 28
findings in `docs/premium-ui/phase2-audit.md` — then three fix chunks.
Commits `8831256`…`ab50166` on `feat/premium-ui-phase-1`.

- **Bugs found by the live audit, not by tests:** accept-flow welcome note was
  silently dropped instead of becoming the first chat message (API
  `acceptRequest` now writes it); /chats hydration mismatch (UTC vs IST
  timestamps); locked "Why we matched" premium reasons shipped to the DOM
  behind a CSS blur (content leak — now placeholder rows); smart-reply "warm"
  chip rendered destructive-red (malformed classes); About-tab Manglik row
  contradicted the horoscope chip (stale boolean field); QA seed photos 404'd
  (key prefix outside the media-router allowlist — seed fixed + files added).
- **Mobile web (360px-first):** stat cards + quick actions to 2×2 grids;
  Virtual Dates panel collapsed to a 44px row (was ~55% of the chat viewport);
  filter tabs and card actions to 44px targets; profile tab bar scroll hint;
  clipped bookmark button fixed.
- **Premium depth:** branded illustrated empty states wired in (variants were
  suppressed by `icon=`); layout-matched dashboard skeleton; photo lightbox
  hover/scrim/hover-lift refinements; shortlist cards gained note display +
  remove; requests accept toast; i18n added (en+hi) for marital-status
  toggles, compatibility dimensions, shortlist actions, page titles.
- **Verification:** cold `turbo type-check --force` 11/11, `pnpm build` green,
  every touched page re-verified in the browser at both widths, zero console
  errors on the core journey.
- **Next:** same playbook for chat-thread interior (composer, media),
  weddings suite, vendors/store, onboarding wizard, admin.

### 2026-07-19 — contract gap-closure sprint

Audited `vivahOS_final_v2.pdf` against the codebase and closed the buildable gaps.
5 parallel teammates + orchestrator verification. Commits `521e66f`…`464888c`.

- **Shipped:** PWA (manifest + allowlist service worker + offline shell, Phase 7);
  mobile biometric re-entry gate (Phase 7); divorcee & widow support completed —
  opt-in write path, onboarding journey, privacy fix (Phase 3); NBFC loan referral
  embedded in the budget tracker, shortfall-gated (Phase 6).
- **Ops:** ROADMAP.md rewritten and then corrected — the first pass cited 66 paths
  of which 26 did not exist. SECURITY-REVIEW.md's 4 "open" findings verified
  already-closed, with citations. CI gained `pnpm audit` + `gitleaks` (advisory,
  `fetch-depth: 0` so history is actually scanned). SLO rows populated where
  measurable, labelled local-loopback floors.
- **Bugs found by verification, not by tests:**
  - Service-worker auth guard checked `set-cookie`, a forbidden response-header
    the browser never exposes — the denylist never fired, so authenticated pages
    and API payloads would have been cached (session bleed on shared devices).
    Replaced with an allowlist.
  - Marital status was returned to non-matched viewers — a live breach of the
    Phase 3 privacy clause and CLAUDE.md rule 5.
  - The divorcee onboarding journey was never mounted, and its dismiss button hit
    a 404, so it would have reappeared on every visit forever.
  - Two duplicate write endpoints existed for one flag; consolidated.
- **Process note:** 4 of 5 teammates reported work as complete whose verification
  did not hold — a test embedding a copy of the logic it guards, a gate no test
  exercised, fabricated doc citations, a theoretical mutation check. Only the
  mutation-check requirement and in-browser driving surfaced these. Type-check and
  the test suite passed throughout.
- **Metrics:** k6 baseline (vendors p95=21ms, feed p95=16ms, analytics p95=38ms —
  all loopback floors). Auth unmeasurable from a single IP (rate-limit working as
  designed). api 1255/1255, mobile 165/165, type-check 11/11, build 7/7.
- **Decisions:** muhurat conventions stay conservative (all 8 disputed dates held
  out) pending the Colonel's ruling; free-tier daily-view quota + tier-feature
  reconciliation identified as the top outstanding revenue work.

### 2026-07-18

- Mobile UI Polish (feat/mobile-ui-polish) complete: design-system tokens, Playfair headings, all Phase 5–8 pages. 295 routes type-check ✓, build ✓. Awaiting operator review + merge.
- Mobile feature parity (Phase 0+1) merged to main.
- Phases 5–8 all Tier-1 units shipped.

### Sprint J (2026-07-17)

- 6.4 Auto-Marketing Engine (segment, Gemini content, approval gate, sweep) + seeded demo traffic (150 vendors, 50 users, 200 bookings).
- 6.5 Multi-City Network (10 reference cities, vendor expansion lifecycle).
- Both behind flags (MARKETING_AUTOMATION_ENABLED, city selection in UI).

### Earlier phases

See `docs/phase-5-8/PHASE-5-8-ROADMAP.md` (§0.0 Status Snapshot) and `docs/PHASE-1-4-AUDIT.md` for full history. Phases 1–4 ship-audit passed 2026-05-20.

---

## How to Launch

1. **External registrations (Colonel's side, parallel):**
   - Razorpay merchant account approval (1 week)
   - MSG91 DLT sender registration (2–4 weeks)
   - DigiLocker partnership (optional for Phase 1; required for Phase 8.1)

2. **Flip flags in production env:**
   ```bash
   USE_MOCK_SERVICES=false          # Turn off all mocks
   RAZORPAY_LIVE=true
   R2_LIVE=true
   MONGO_LIVE=true
   VIDEO_LIVE=true (optional Day 1)
   KYC_LIVE=false (Phase 2: true)
   ESIGN_LIVE=false (Phase 3: true)
   RETENTION_OUTREACH_LIVE=false    # Turn on Week 2 after launch calibration
   ```

3. **Staging smoke test (24 h before go-live):**
   - Create a user, complete KYC (mock), book a vendor, process a payment (mock), check Sentry.
   - Verify all role dashboards render.

4. **Launch:**
   - Flip `USE_MOCK_SERVICES=false` on Railway + Vercel.
   - Set real Razorpay keys + MSG91 keys in env.
   - Monitor `/health` + `/ready` + Sentry for 24 h.

5. **Post-launch (Week 1–4):**
   - Calibrate SLOs from real traffic (goal: P95 < targets in SLO-AND-ALERTING.md).
   - Enable retention outreach (RETENTION_OUTREACH_LIVE=true) Week 2.
   - Collect feedback, fix UX bugs.

---

## What's NOT Here

- **PWA** (progressive web app install) — deferred; works in browser as-is
- **GraphQL** — intentionally excluded; REST scales fine for this product scope
- **Server-side caching beyond Redis** — CDN edge caching for static pages deferred (Vercel handles)
- **Machine-learning retraining pipeline** — not in scope; models are evergreen (Guna Milan + sentiment + DPI)
- **Open-source release** — internal product; code not published

---

## Recommended Reading

- **Operator docs:** `docs/handover/HANDOVER-INDEX.md` (entry point)
- **Architecture:** `docs/adr/` (10 ADRs covering major decisions)
- **Deployment:** `docs/PROVIDER-ACTIVATION/` (secrets + credentials playbook)
- **Incident response:** `docs/RUNBOOK.md` (top 5 incidents + fixes)
- **Performance:** `docs/handover/SCALING-PLAYBOOK.md` + `perf/BASELINE.md`
- **Security:** `docs/SECURITY-REVIEW.md` (this session's update below)

---

## Dependencies — By Owner

| Item | Owner | Status | Deadline |
|------|-------|--------|----------|
| Razorpay live merchant account | Colonel | Pending | Before launch |
| Razorpay subscription plan IDs (4 create in dashboard) | Colonel | Pending | Before launch |
| MSG91 DLT template approval (government) | Colonel | Pending | Before launch |
| DigiLocker OAuth partnership (optional Phase 1) | Colonel | Pending | Before Phase 2 KYC toggle |
| AWS Rekognition account setup | Colonel | Pending | Before KYC toggle |
| Daily.co account + API key | Colonel | Pending | Optional (video calls work mocked) |
| Apple Developer Program + provisioning | Colonel | Pending | Before App Store submission |
| Google Play Developer Program + signing | Colonel | Pending | Before Play Store submission |
| NBFC lending partner agreement | Colonel | Pending | Before lending features |
| Insurance partner agreement | Colonel | Pending | Before insurance features |
| WhatsApp Business API registration | Colonel | Pending | Before WhatsApp notifications |
| Staging environment deployment | Engineering | Ready (blocked on decision) | Post-launch calibration |
| Penetration test vendor (OWASP ASVS Level 2) | Engineering | Not started | Post-launch Week 2–4 |
| Sentry + PostHog + BetterStack secrets (already wired) | Colonel | Pending (env vars in Vercel/Railway) | Before launch |

---

## Footer

This roadmap reflects the state at **2026-07-19** after the 5-agent parallel sprint on documentation.
Every claim is traceable to a file path, migration, or commit. **Re-read this at the start of every session** — update the "Current Status" block and "Recent Session History" if anything changes.

For questions on feature status or blockers, refer to the **Evidence** column in each Phase table; the file paths point to working code.
