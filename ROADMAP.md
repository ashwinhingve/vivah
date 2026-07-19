# Smart Shaadi — Roadmap

> **Update this file at the end of every development session.**
> Claude Code reads this to understand current progress and next targets.

---

## Current Sprint

```
Phase:    2 — Wedding & Event Planning (in progress)
Week:     7 of 9 — Starting
Target:   Video Calls + Escrow + Rental Module
Blocker:  None
Mocks:    USE_MOCK_SERVICES=true
Last updated: 2026-04-21
```

### Phase 7 Sprint E — Mobile scaffold (2026-07-18) — `sprint/e-mobile-scaffold` → merged `main`

Stood up `apps/mobile` (React Native + Expo SDK 57 / RN 0.86 / Expo Router / NativeWind)
as a **scaffold only** — no feature parity. 2-teammate parallel build (Opus, bypass rule)
on a frozen Phase-0 base, then single-agent integration.
- **pnpm↔Metro integration** — `.npmrc` public-hoist of `@smartshaadi/*` + the nativewind
  runtime (`react-native-css-interop`); metro watchFolders/nodeModulesPaths. Proven by
  `expo export` bundling 1529+ modules (5.1MB Hermes).
- **Auth** — phone-OTP over the Better Auth **cookie** session on native via `@better-auth/expo`
  (`expoClient` persists the cookie in expo-secure-store; server `expo()` plugin + `smartshaadi://`
  trusted origin in `apps/api/src/auth/config.ts`). Auth gate + phone/verify screens + Home
  reads `useSession()` (proves the cookie round-trips to `/api/auth/get-session`).
- **Design system** — NativeWind tokens (ivory/burgundy/teal/gold); reusable Screen/Button/Field.
- **CI** — `eas.json` (dev/preview/prod) + GitHub Actions EAS workflow (needs `EXPO_TOKEN`).
- **Verified** — `pnpm type-check --force` 9/9, mobile jest 6/6, expo-doctor 20/20, Metro
  android bundle export.
- **⬜ Deferred (needs Apple/Google/Expo enrolment)** — live EAS cloud build; on-device OTP
  against a real QA account (`USE_MOCK_SERVICES=true` / `MOCK_OTP_VALUE`). **Not pushed** —
  29 commits sit unpushed on `main`; awaiting a push/deploy decision.

### Premium uplift + gap-fill (2026-07-08, in progress) — `feat/all-roles-production`

Audit of all 5 roles found dead links + generic UIs. Landed (api+web type-check +
prod build green): shared `RoleHero` + illustrated empty-state presets + DataTable
row-selection + i18n role namespaces; **fixed 2 coordinator 404s** (routing + calendar
pages); **family co-pilot now works** (browse a linked seeker's matches + draft interest,
consent-gated) with humanized inbox + secure invite-by-own-code + INDIVIDUAL nav access;
premium heroes on admin/support/vendor-dashboard; **vendor-dashboard RBAC guard** (was
missing); support pagination. Security review fixes: removed user-enumeration lookup,
scoped name-resolve authorization.

✅ Then completed (4 parallel squads + solo): SUPPORT filters/search/new-ticket + report
severity/reassign/canned-replies/notifications; VENDOR package + portfolio-item CRUD + media
upload + wizard chrome + premium leads/payouts; ADMIN audit export/filters + bulk user actions;
COORDINATOR task inbox; FAMILY humanized parent-mode + real Pillar-2 + compatibility fix.
**Runtime-verified**: all 6 roles × key pages = 24/24 render 200, zero 500s, RBAC enforced;
api+web type-check + prod build green.

⬜ Minor leftovers: full i18n of still-hardcoded role pages; support report content-preview
(needs ChatReport schema change); R2 media upload verifies on Railway only (TLS-blocked local);
visual 375/1280 responsive pass (HTTP smoke was render-only).

### All-roles production sprint (2026-07-07) — `feat/all-roles-production`

Brought all 5 non-INDIVIDUAL roles to the INDIVIDUAL quality bar. Full type-check
(api + web) + prod build green (295 web pages, all new routes registered).

- **SUPPORT** — new tables (`support_tickets`/`ticket_messages`/`ticket_events`,
  migration `0031`) + `/api/v1/support` router + full staff console (queue, ticket
  detail with thread/internal-notes/reply/history, chat-abuse reports triage).
- **ADMIN** — audit-log viewer + user management (list/detail/suspend) routers
  mounted; web pages + ReputationCard + home recent-activity feed.
- **VENDOR** — portfolio + event-types write services (7 owner-scoped routes);
  6-step onboarding wizard; reviews reply UI; insights (views/saves/leads funnel).
- **FAMILY** — hub + link-creation flow (`/family/link/new`, wires createLink).
- **COORDINATOR** — rebuilt dashboard + vendor-routing tool + cross-wedding calendar.
- Nav `*_MORE_GROUPS` for all 4 roles + admin audit/users; i18n keys (en + hi).

**⬜ TODO before prod:** apply `packages/db/migrations/0031_support_tickets.sql`
(additive/idempotent) to the Railway prod DB — applied to local only.

### Week 6 shipped (2026-04-21)

- Wedding planning shared contracts (types + schemas + MongoDB WeddingPlan model) — commit `b82ffac`
- Wedding core domain: wedding plan, task Kanban, budget tracker, auto-checklist by months-until-wedding — commit `f27d7c0`
- Guest management: guest list, bulk import (500 cap), RSVP tracking, invitation mock send, token-based public RSVP endpoint — commit `4d557d1`
- Wedding UI: `/weddings`, `/weddings/new`, `/weddings/[id]` overview + tasks + budget + guests pages, click-arrow Kanban, CSS-only meal-pref donut, "My Wedding" AppNav entry — commit `0a78635`
- Phase 2 integration: routers mounted at `/api/v1/weddings` and `/api/v1`, dashboard wired with WeddingCard + empty-state CTA, `GET /weddings` list endpoint, `autoGenerateChecklist` auto-fires on create when weddingDate present — commit `e056fbf`
- Bug fixes during live smoke: `mockGetPlan` now unwraps mockStore `.plan` wrapper; guest `assertWeddingOwner` now resolves `userId → profileId` via `profiles` table (no more silent 403) — commit `d07ee8e`
- Live HTTP smoke: 20/20 endpoints PASS (see `docs/smoke-test-week6.md`)
- Unit tests: 205/205 (was 182 → +23 wedding/guest tests, zero regressions)
- Type-check clean across all 8 packages; web build clean including 6 new `/weddings/*` routes
- New CLAUDE.md rule 12: always resolve `userId → profileId` before touching profile-keyed columns

### Phase 1 audit fixes (2026-04-20)

- Privacy rule #5 now enforced: `GET /api/v1/profiles/:id` masks phone/email for all non-self viewers; only `GET /api/v1/profiles/:targetUserId/contact` exposes contact after ACCEPTED match
- New endpoint `PUT /api/v1/profiles/me/safety-mode` — updates user safetyMode settings in ProfileContent
- New endpoint `GET /api/v1/admin/stats` — returns totalUsers, activeVendors, bookingsThisMonth
- Dashboard wired to `/api/v1/matchmaking/feed?limit=3` — real Recommended cards replace skeleton placeholders
- CompletenessBar chips link to `/profile/[section]` — click any chip to resume onboarding
- Match age now `number | null` end-to-end; MatchCard omits age when missing instead of showing 0 or 28
- Match card gets `gunaPending` overlay prompting horoscope entry when score is not yet computed
- VendorPortfolio + VendorCard + vendor detail page + payments page: remaining `#0A1F4D`/`#1848C8`/`bg-blue-*` replaced with Teal/Burgundy tokens
- Undefined `font-playfair` utility replaced with `font-heading` on career, lifestyle, horoscope, community, photos, error.tsx
- Touch-target 44px minimum applied to all remaining CTAs on dashboard, matches, requests
- Razorpay webhook deduplicated — sole registration in `apps/api/src/index.ts`
- Admin page forces dynamic rendering; dashboard forces dynamic rendering
- Vendor service returns `portfolio: null` in mock mode instead of placeholder "Mock portfolio — enable real services" copy

---

## ✅ Completed

### Week 1 — Complete ✅
- [x] Monorepo setup (pnpm workspaces + Turborepo)
- [x] Docker Compose (PostgreSQL, MongoDB, Redis, Adminer)
- [x] GitHub Actions CI pipeline (quality → test → build → e2e → release)
- [x] PostgreSQL schema via Drizzle ORM (all tables + enums)
- [x] Better Auth setup (phone OTP, mock OTP, email+pw, JWT, 6 roles)
- [x] Auth middleware + auth router
- [x] Auth integration tests
- [x] Next.js auth pages (login, register, verify-otp, role picker)
- [x] KYC module: Aadhaar verification flow
- [x] KYC module: Photo fraud detection (AWS Rekognition)
- [x] KYC module: Duplicate account detection
- [x] Verified badge system
- [x] Profile API module (GET/PUT /me, GET /:id, safety masking)
- [x] Storage router (R2 pre-signed PUT URLs, mock mode)
- [x] DB seed (3 test users: INDIVIDUAL, VENDOR, ADMIN)
- [x] App-level .env.example files (api, web, ai-service)
- [x] AI service health test
- [x] Next.js profile creation page (3-step: details → safety → photos)
- [ ] Landing page (smartshaadi.com) — hero, features, how it works, CTA
- [x] Deploy to Vercel production URL ✅
- [ ] Share with Colonel Deepak for feedback

---

## 🔵 PHASE 1 — Core Platform (Weeks 1–5)

**End goal: Platform live, first revenue flowing**

### Week 1 ✅

- [x] Monorepo setup (pnpm workspaces + Turborepo)
- [x] Docker Compose (PostgreSQL, MongoDB, Redis, Adminer)
- [ ] GitHub repo + branch protection rules
- [x] GitHub Actions CI pipeline (lint → type-check → test → deploy preview)
- [ ] Railway project (API service + AI service + Redis + PostgreSQL)
- [ ] Vercel project (web app)
- [ ] Cloudflare R2 bucket `smart-shaadi-media`
- [ ] AWS SES domain verification
- [ ] **SUBMIT:** Razorpay merchant account (3–5 day activation)
- [ ] **SUBMIT:** Digilocker KYC API application (5–10 day approval)
- [ ] **SUBMIT:** MSG91 DLT sender registration (5–10 days)
- [x] Better Auth setup (phone OTP + email + JWT + 6 roles)
- [x] PostgreSQL schema via Drizzle (users, sessions, profiles, photos, kyc, safety…)
- [ ] MongoDB connection (profiles_content collection)
- [x] KYC module: Aadhaar verification flow ✅
- [x] KYC module: Photo fraud detection (AWS Rekognition) ✅
- [x] KYC module: Duplicate account detection ✅
- [x] Verified badge system ✅
- [x] Profile API module (GET/PUT /me, GET /:id, safety masking) ✅
- [x] Storage router (R2 pre-signed PUT URLs, mock mode) ✅
- [x] DB seed (3 test users: INDIVIDUAL, VENDOR, ADMIN) ✅
- [x] App-level .env.example files ✅
- [x] AI service health tests ✅
- [x] Next.js profile creation page (3-step form) ✅
- [x] Profile schemas (`packages/schemas`) — complete ✅
- [x] Profile TypeScript types (`packages/types`) — complete ✅
- [x] Profile content sub-endpoints (`/me/content/*`) — complete ✅
- [x] Profile wizard extended to 4 steps — complete ✅
- [x] Photo registration bug fixed — complete ✅
- [x] Root layout metadata (SEO, Open Graph, fonts) ✅
- [x] Design system tokens in globals.css (`@theme` block, full palette) ✅
- [x] Design system audit — all off-palette colors fixed across web ✅
- [x] Form input & CTA button consistency pass (font-semibold, correct colors) ✅
- [x] Route group loading/error boundaries `(auth)` + `(profile)` ✅
- [x] `lib/env.ts` client/server env utility ✅
- [x] Dashboard stub page ✅
- [x] Security hardening: helmet, CORS allowedHeaders, body-parser 50kb limit ✅
- [x] Test stubs for profiles/service, profiles/content.service, storage, users ✅
- [x] All tests passing (57 total) ✅
- [x] Type-check clean across all workspaces ✅
- [x] Lint clean across all workspaces ✅
- [ ] Landing page (smartshaadi.com) — hero, features, how it works, CTA
- [x] Deploy to Vercel production URL ✅
- [ ] Share with Colonel Deepak for feedback

### Week 2

- [x] Profile module: personal details form ✅ Day 6
- [x] Profile module: Safety Mode (contact gating) ✅ Day 8
- [x] Profile module: family, education, profession fields ✅ Day 6–7
- [x] Profile module: lifestyle + hyper-niche tags ✅ Day 7
- [x] Profile module: partner preferences ✅ Day 8
- [x] Profile module: horoscope data (Rashi, Nakshatra, DOB/TOB/POB) ✅ Day 8
- [x] Profile photos: R2 upload via pre-signed URLs ✅ Day 10
- [x] Profile photos: multi-upload, drag-to-reorder, set-primary, delete ✅ Day 10
- [x] Community Match Zones: zone assignment + language preference ✅ Day 8
- [x] Profile view page: luxury redesign with all sections ✅ Day 10
- [x] Photo onboarding flow: /profile/photos → /profile/complete ✅ Day 10
- [x] Week 2 production audit: design system compliance, route boundaries ✅ Day 10 post-audit

### Week 3

- ✅ Reciprocal Matching engine (bilateral compatibility pre-check)
- ✅ Guna Milan calculator: all 8 factors (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi)
- ✅ Compatibility score display on profile cards
- ✅ Match feed with reciprocal filtering

### Week 4

- [ ] Match requests: send, accept, decline, withdraw
- [ ] Match requests: block and report
- [ ] Match requests: contact visibility controls
- [ ] Real-time chat: Socket.io server setup
- [ ] Real-time chat: message persistence (MongoDB)
- [ ] Real-time chat: photo sharing (R2 pre-signed)
- [ ] Real-time chat: read receipts
- [ ] Real-time chat: Hindi–English translation integration

### Week 5

- [ ] Vendor listing pages (category + city filter)
- [ ] Vendor portfolio pages (photos, packages, pricing)
- [ ] Booking system: request → confirm → schedule → complete
- [ ] Booking system: cancellation flow
- [ ] Razorpay integration: UPI, cards, net banking, wallets, EMI
- [ ] Invoice generation (PDF via pdfkit)
- [ ] Refund handling (Razorpay refund API)
- [ ] Customer dashboard (matches, bookings, notifications, profile status)
- [ ] Vendor dashboard (calendar, bookings, revenue summary)
- [ ] Admin dashboard (user management, vendor approval, complaints)
- [ ] End-to-end QA — Phase 1
- [ ] Production deployment — Phase 1 live 🚀

---

## 🟢 PHASE 2 — Wedding & Event Planning (Weeks 6–9)

**End goal: Complete planning suite live**

- [x] Wedding plan creation (date, venue, style, theme, couple link)
- [x] Budget tracker by category (venue, catering, decor, photography…)
- [x] Kanban task board (auto-checklist from wedding date)
- [ ] Wedding day timeline builder
- [ ] Mood board + theme selection
- [ ] Family member access (role-based permissions, task assignment)
- [x] Guest list management (manual + spreadsheet import)
- [x] RSVP tracking (yes/no/maybe)
- [x] Meal preference collection
- [ ] Room allocation (outstation guests)
- [ ] Digital invitation builder (template + couple photo)
- [x] Invitation delivery: email + SMS (mocked — real AWS SES/MSG91 deferred)
- [x] In-platform video calls (Daily.co mocked)
- [x] Meeting scheduler (slot proposal + confirmation)
- [x] Escrow dispute system (raise + admin resolve + audit log)
- [x] Rental catalogue (decor, costumes, AV)
- [x] Rental booking (date-range, quantity, availability check)
- [x] E-Commerce Store: vendor product listings (gifts, trousseau, ethnic wear, pooja items, invitation cards, decor pieces)
- [x] E-Commerce Store: shopping cart + Razorpay checkout (mocked)
- [x] E-Commerce Store: order management flow (placed → confirmed → shipped → delivered)
- [x] E-Commerce Store: vendor product dashboard (inventory, orders, revenue)
- [x] E-Commerce Store: order tracking + delivery coordination
- [ ] Multi-event booking extension (corporate, festival, community types)
- [ ] Firebase push notifications (all key events)
- [x] Pre-wedding ceremony modules: Haldi, Mehndi, Sangeet (Week 8)
- [x] Muhurat date selector (Week 8 — deterministic algorithm, horoscope integration deferred)
- [x] Week 8 hardening sprint — Video P0 (deterministic rooms, SCAN loop, status guards, TTL from scheduledAt), Escrow P0 (deterministic Bull cancel, optimistic lock, DB-before-Razorpay with RELEASE_PENDING/REFUND_PENDING fallbacks, audit enum swap), Rental P0 (transactional overbook guard, ACTIVE transition, availableQty, public pages)
- [x] End-to-end QA — Phase 2 (Week 9 audit: 11 ✅ · 4 ⚠️ · 0 ❌)
- [ ] Production deployment — Phase 2 live 🚀

---

## 🟣 PHASE 3 — AI Intelligence Layer (Weeks 10–11)

**End goal: Six AI features live, platform self-improving**

- [ ] FastAPI AI service deployed to Railway
- [ ] Data pipeline from Phase 1–2 user data
- [ ] AI Conversation Coach (profile interest extraction, in-chat suggestions)
- [ ] Emotional Compatibility Score (sentiment analysis, response timing)
- [ ] AI Profile Optimizer (photo quality, bio scoring, suggestions panel)
- [ ] Marriage Readiness Score (composite model, user-controlled display)
- [ ] Family Compatibility Mode (dual score view, Parent Mode)
- [ ] Reputation Score (response rate, communication consistency)
- [ ] Divorcee & Widow Support Mode (dedicated filters, private flag)
- [ ] Behaviour-Based Matching signal layer (view time, browse patterns)
- [ ] Predictive Churn Detection (risk classifier, automated win-back)
- [ ] Divorce Probability Indicator (private risk signal, 10-factor model, shown to user only — not public)
- [ ] Matrimony AI Assistant (unified conversational guide)
- [ ] Vendor Utilization Engine Foundation (off-season routing begins)
- [ ] End-to-end QA — Phase 3
- [ ] Production deployment — Phase 3 live 🚀

---

## 🟡 PHASE 4 — Scale & Market Readiness (Weeks 12–13)

**End goal: Subscriptions, SEO, market-ready**

- [ ] Subscription tiers (Free / Standard / Premium)
- [ ] Razorpay Subscriptions integration
- [ ] Feature gating per tier
- [ ] Full Hindi language support
- [ ] i18n framework (extension-ready for regional languages)
- [ ] Auto-SEO engine (LLM-generated community × city pages)
- [ ] Structured data markup (Google rich results)
- [ ] Dynamic pricing foundation (demand-based price signals)
- [ ] Vendor lead generation fee system
- [ ] Referral programme (codes, rewards, dashboard)
- [ ] GDPR data controls (consent, deletion, portability)
- [ ] Immutable audit logs (KYC, payment, contract events)
- [ ] Analytics dashboard (growth, conversion, revenue, churn)
- [ ] LGBTQ+ configurable matching (admin-level toggle)
- [ ] Full platform security audit + load testing
- [ ] End-to-end QA — Phase 4
- [ ] Production deployment — Phase 4 live 🚀

---

## 🔵 PHASE 5 — Vendor Utilization Engine (Expansion Month 4)

> **Sprint A shipped (2026-07-17)** — VUE + Calendar + B2B merged to main (`f46e826`).
> **Sprint B shipped (2026-07-17)** — Dynamic Pricing + Vendor Gap Detection merged
> to main (`f7bde4f`, local — not yet pushed/deployed).

- [x] Full Vendor Utilization Engine (wedding → off-season event routing) — Sprint A
- [x] Vendor Gap Detection (city-level category alerts) — Sprint B (`/admin/gaps`, threshold-configurable)
- [x] Calendar Intelligence (muhurat, government, festival, school calendars) — Sprint A
- [x] Dynamic Pricing full (muhurat premium, off-season discounts) — Sprint B (ADR-001 PricingAdvisor, `/vendor/pricing`)
- [x] Documentation & Compliance module — Sprint C (`/api/v1/documents`)
- [x] Digilocker e-sign integration — Sprint C (mocked behind `ESIGN_LIVE`; live swap = creds only)
- [x] Contract template generator — Sprint C (`documents/templates.ts` + contract PDF)
- [x] B2B Self-Serve (corporate registration, event catalogue, invoiced bookings) — Sprint A
- [x] Advanced analytics & demand forecasting — Sprint C (`/api/v1/analytics`, pure-SVG)
- [ ] Production deployment — Phase 5 live 🚀

---

## 🟢 PHASE 6 — Financial & Growth (Expansion Month 5)

- [ ] NBFC partner API integration (loan referral flow)
- [ ] EMI calculator in budget tracker
- [ ] Wedding insurance referral flow
- [x] Auto-Marketing Engine — Sprint J (6.4, migration 0038). Full lifecycle: 5 SQL
      segments, EVENT/SCHEDULED/SEGMENT_SWEEP triggers (hooks: registration/KYC/booking),
      Gemini copy via ai-service `/ai/marketing/generate` (en+hi, template fallback),
      per-language admin approval gate (no dry-run fork — nothing sends until ACTIVE +
      approved content), consent-gated dispatch (`notification_preferences.marketing`),
      Redis weekly frequency cap, partial-unique send dedup, sweep-based conversion
      attribution, `/admin/marketing` dashboard + create form + detail/approval UI.
      `MARKETING_AUTOMATION_ENABLED` kill-switch (default ON). Validated against seeded
      demo traffic (150 vendors/50 users/200 bookings), NOT market traffic — conversion
      tuning still needs launch. Bull queues only, no n8n (architecture rule 1/8).
- [x] Multi-city vendor network — Sprint J (6.5, migration 0038). `cities` registry
      (10 reference cities seeded, expansion lifecycle ACTIVE/EXPANSION/PLANNED),
      `vendors.city_id` backfill (free-text `city` untouched — filters/SEO unchanged),
      `/admin/cities` ops dashboard (per-city density vs target, coverage, 90d
      bookings/revenue, unmapped-vendor surfacing), public `GET /api/v1/cities`.
- [ ] WhatsApp Business API integration
- [ ] Production deployment — Phase 6 live 🚀

---

## 🟣 PHASE 7 — Mobile & International (Expansion Month 6)

- [x] React Native + Expo mobile app scaffold — Sprint E (Expo SDK 57, phone-OTP cookie auth)
- [x] Mobile UI/UX audit & polish (2026-07-19, branch `feat/mobile-ui-polish`) — design system
      with automatic light+dark theming (CSS-var tokens + `useThemeColors`), Playfair Display
      headings, reusable primitives (Button/Input/Screen/Card/OTPInput/LoadingView/ErrorBanner/
      InfoNote), a11y on every interactive element (was zero), haptics + reanimated press/shake
      animations, segmented OTP auto-submit + 30s resend, sign-out confirm, pull-to-refresh,
      keyboard avoidance; 15 hardcoded hex removed; jest migrated to jest-expo+RNTL (17 tests).
      Gates: type-check ✓ lint ✓ tests 17/17 ✓ Android bundle export ✓ headless-browser verify
      of web build (light+dark render, validation + error states, Playfair loaded) ✓.
      On-device haptics/dark-mode check pending. Awaiting operator review + merge to main.
- [ ] iOS and Android feature parity
- [ ] Biometric login
- [ ] EAS Build CI/CD
- [ ] Apple App Store submission
- [ ] Google Play Store submission
- [x] NRI & international matching (country filters, time zone scheduling) — Sprint G (7.2, migration 0034) · behind `NRI_MATCHING_LIVE` (OFF until launch validation)
- [x] Virtual Date System (durable scheduling, T-24h/T-15m reminders, curated icebreakers, post-date feedback) — Sprint F (7.3) · AI activities / WebGL deferred
- [x] Advanced Churn Recovery (Stay Quotient daily sweep → win-back attempts, `RETENTION_OUTREACH_LIVE` DRY_RUN default) — Sprint F (7.3)
- [ ] Production deployment — Phase 7 live 🚀

---

## 🟡 PHASE 8 — National Platform (Expansion Month 6)

- [x] Destination Wedding Module — **planning core (Sprint I, Unit 8.1, migration
      0036).** Multi-city "legs" (`wedding_destinations`) with country/timezone/
      date window, ceremonies attachable per leg, and per-leg guest travel
      (`guest_travel_legs`). API at `/api/v1/weddings/:weddingId/destinations`,
      UI at `/weddings/[id]/destinations` (list · detail · new · edit), sidebar
      entry in Planning, en+hi.
      **Premium packages / destination supply deliberately NOT built** — Tier 3,
      blocked on venue + vendor partnerships (see PHASE-5-8-ROADMAP.md §4).
      Full DoD met: type-check --force green; api 1174 tests (+43), mutation-
      checked; migration applied twice (idempotent) with all four DB invariants
      exercised on real rows; authenticated HTTP E2E 21/21 + data-path E2E 10/10;
      browser-verified as a real QA login at 375px and 1440px in en and hi.
- [ ] Post-marriage services (honeymoon, anniversary, referral pathways)
- [x] National auto-scaling infrastructure — Sprint H (8.3, migration 0035): scale indexes,
      k6 suite, `/metrics` histogram, circuit breakers, queue concurrency, `/ready` timeouts
      (k6 baseline + SLO calibration pending staging/traffic)
- [ ] Government integration readiness
- [x] PDF reporting (vendors, couples, admin) — Sprint H (`/api/v1/reports`, `lib/pdf/`)
- [x] Project handover documentation — Sprint H (`docs/handover/` — HANDOVER-INDEX,
      SCALING-PLAYBOOK, INDEX-PLAN, SLO-AND-ALERTING, ENV-MATRIX)
- [ ] Production deployment — Phase 8 complete 🎉
- [x] UI Polish Sprint 2 (2026-07-18, branch `ui-polish-2/2026-07`) — all Phase 5–8 feature pages
      brought to design-system standard (PageHeader/EmptyState/motion/tokens/boundaries + full
      en-hi i18n, 295 new keys via fragment-merge protocol); Phase 1–4 residuals fixed (16 token
      drifts, 30 missing loading/error boundaries); nav entries for Documents / Smart Pricing /
      Retention. 7 shared-tree teammates (no worktrees — broken on this box), orchestrator-verified.
      Gates: type-check ✓ build ✓ authenticated en+hi page-render smoke ✓ (lint blocked by a
      pre-existing missing `@typescript-eslint/eslint-plugin` at root — also broken on main).
      Awaiting operator review + merge to main.

---

## Blockers & Notes

_Add blockers here with date:_

```
[YYYY-MM-DD] Description of blocker and what's needed to unblock
```

---

## Dependencies — Submit Before Building

| Item | Status | Deadline |
|------|--------|----------|
| Razorpay merchant account | ⬜ Not submitted | Submit Day 1 |
| Digilocker KYC API | ⬜ Not submitted | Submit Day 1 |
| MSG91 DLT registration | ⬜ Not submitted | Submit Week 1 |
| WhatsApp Business API | ⬜ Not submitted | Submit start of Phase 6 |
| Apple Developer Program | ⬜ Not submitted | Submit start of Phase 7 |
| Google Play Console | ⬜ Not submitted | Submit start of Phase 7 |
| NBFC lending partner agreement | ⬜ Not confirmed | Confirm before Phase 6 |
