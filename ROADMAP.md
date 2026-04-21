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
- [ ] In-platform video calls (Daily.co)
- [ ] Meeting scheduler (slot proposal, confirmation, reminders)
- [ ] Escrow payment system (50% advance, 48h dispute window)
- [ ] Rental catalogue (decor, costumes, AV)
- [ ] Rental booking (date-range, quantity, return tracking)
- [ ] E-Commerce Store: vendor product listings (gifts, trousseau, ethnic wear, pooja items, invitation cards, decor pieces)
- [ ] E-Commerce Store: shopping cart + Razorpay checkout
- [ ] E-Commerce Store: order management flow (placed → confirmed → shipped → delivered)
- [ ] E-Commerce Store: vendor product dashboard (inventory, orders, revenue)
- [ ] E-Commerce Store: order tracking + delivery coordination
- [ ] Multi-event booking extension (corporate, festival, community types)
- [ ] Firebase push notifications (all key events)
- [ ] Pre-wedding ceremony modules: Haldi, Mehndi, Sangeet
- [ ] Muhurat date selector (integrated with horoscope data)
- [ ] End-to-end QA — Phase 2
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

- [ ] Full Vendor Utilization Engine (wedding → off-season event routing)
- [ ] Vendor Gap Detection (city-level category alerts)
- [ ] Calendar Intelligence (muhurat, government, festival, school calendars)
- [ ] Dynamic Pricing full (muhurat premium, off-season discounts)
- [ ] Documentation & Compliance module
- [ ] Digilocker e-sign integration
- [ ] Contract template generator
- [ ] B2B Self-Serve (corporate registration, event catalogue, invoiced bookings)
- [ ] Advanced analytics & demand forecasting
- [ ] Production deployment — Phase 5 live 🚀

---

## 🟢 PHASE 6 — Financial & Growth (Expansion Month 5)

- [ ] NBFC partner API integration (loan referral flow)
- [ ] EMI calculator in budget tracker
- [ ] Wedding insurance referral flow
- [ ] Auto-Marketing Engine (n8n + Claude API, content pipeline)
- [ ] Multi-city vendor network
- [ ] WhatsApp Business API integration
- [ ] Production deployment — Phase 6 live 🚀

---

## 🟣 PHASE 7 — Mobile & International (Expansion Month 6)

- [ ] React Native + Expo mobile app scaffold
- [ ] iOS and Android feature parity
- [ ] Biometric login
- [ ] EAS Build CI/CD
- [ ] Apple App Store submission
- [ ] Google Play Store submission
- [ ] NRI & international matching (country filters, time zone scheduling)
- [ ] Virtual Date System (video + AI activities + WebGL environments)
- [ ] Advanced Churn Recovery (ML-based re-engagement)
- [ ] Production deployment — Phase 7 live 🚀

---

## 🟡 PHASE 8 — National Platform (Expansion Month 6)

- [ ] Destination Wedding Module (premium packages, multi-city coordination)
- [ ] Post-marriage services (honeymoon, anniversary, referral pathways)
- [ ] National auto-scaling infrastructure
- [ ] Government integration readiness
- [ ] PDF reporting (vendors, couples, admin)
- [ ] Project handover documentation
- [ ] Production deployment — Phase 8 complete 🎉

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
