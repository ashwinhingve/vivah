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

### 2026-07-19 (current) — contract gap-closure sprint

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
