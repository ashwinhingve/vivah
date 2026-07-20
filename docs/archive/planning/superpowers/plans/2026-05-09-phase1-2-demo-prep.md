# Phase 1+2 Demo Prep Plan — 2026-05-09 (REVISED 14:10 UTC)

> Mirror this file to `docs/superpowers/plans/2026-05-09-phase1-2-demo-prep.md` as Phase 0 (the user brief expects it there). Harness limits in-plan edits to this single file.

## Scope change — 14:10 UTC

User tightened scope to a strict 15–20 min flow: Landing → Auth → Profile + Safety → Match flow → Chat → Vendor + Wedding → Close.

**OUT of scope:** e-commerce, rentals, dispute booking, public RSVP token, video call seed, 28-route polish, full demo collateral suite.

Phases 0, A, B already shipped (see logs above):
- **Phase 0** ✅ plan mirrored
- **Phase A** ✅ baseline captured (8/8 type-check, 543/543 API tests, 4 docker svcs healthy)
- **Phase B** ✅ B1 grep clean, B2 budget reshape +3 tests (546/546), B4 `lib/format.ts`, B5 MockBanner, B6 chat translate toggle, B7 video isMock badge

Phases C/D/E/F are REPLACED below.

## Context

Phases 1 & 2 are functionally complete (310/310 tests, 11 ✅ in `docs/phase2-qa-report.md`) but seed data is anemic and 4 routes referenced by the brief don't exist as standalone pages. Mission: make the platform demo-ready for Colonel Deepak — every screen rich, every empty state polished, every mock transparently labelled, and three demo collateral docs in hand. End-state: Ashwin can run `pnpm db:reseed && pnpm dev`, log in as Priya, walk a 30-minute live tour with no "uh, this is empty" moments.

User locked-in decisions (2026-05-09):
- **Seed strategy:** drop + rebuild (wipe `.data/mockStore.json` + truncate seed tables, repopulate with 14 brief personas on `+91 99999 ...` prefix).
- **Wedding subroutes:** split `/weddings/[id]/ceremonies` and `/weddings/[id]/muhurat` into their own page.tsx files.
- **Mock banner:** top bar mounted in `(app)`, `(auth)`, `(marketing)` root layouts.

---

## §A — Baseline (read-only, captured Phase A)

### Reality vs brief assumptions

| Assumption | Reality | Action |
|---|---|---|
| 3 users seeded | 6 users (4 INDIVIDUAL + 1 VENDOR + 1 ADMIN) on `+91 88888 0001-6` | Drop + rebuild with 14 brief personas |
| Persona = Priya Khanna / Arjun Malhotra | Priya **Sharma** + Rahul Verma (Mongo says Arjun Mehta — name drift) | Rename to brief identities |
| 7 vendors with portfolios | 1 generic "Test Vendor", no Mongo portfolio | Build 7 vendors + 7 portfolios |
| `wedding_vendors` table | Actually `wedding_vendor_assignments` | Use real name in seed |
| `match_scores.gunaScore` | Actually `guna_milan_score` (0-36) + `total_score` (0-100) | Seed both |
| `users.verifiedAt` / `kycStatus` | Don't exist — KYC on `kyc_verifications` table | Seed `kyc_verifications` rows |
| Budget GET shape | Returns `{ categories: [] }` only — no total/spent/remaining | Reshape endpoint + add test |
| `/chat` root, `/weddings/[id]/ceremonies`, `/weddings/[id]/muhurat`, `/rentals/bookings` | Don't exist as separate pages | Build 4 new pages |
| `apps/web/src/lib/format.ts` | Doesn't exist | Build with `formatINR`, `formatPhoneIN`, `formatDateIN` |
| Mock mode banner | Doesn't exist | Build + mount in 3 layouts |
| `db:reseed` script | Doesn't exist | Add to root `package.json` |
| Translate button (chat) | API ready (`POST /api/v1/chat/translate`) — UI button missing | Add toggle to `ChatView.client` |
| Daily.co video "Mock" label | Mock returns URL but no flag in response | Add `isMock: true`; render badge |
| OTP `123456` | Read from `MOCK_OTP_VALUE` env — no hardcoded fallback | Document `.env.local` requirement; banner shows it |
| `userId` → `profileId` boundary | No live offenders found by grep — defensive comments at `guests/service.ts:98`, `weddingReminderJob.ts:39` | Phase B will run a final exhaustive grep |

### Path mismatches (preserve existing routes; add aliases/redirects only when brief demands)

- Brief `/(profile)/onboarding/*` → actual `apps/web/src/app/(onboarding)/profile/{step}/page.tsx`. Update demo doc references; no code change.
- Brief `/profile/[id]` → actual `/profiles/[profileId]`. Update demo doc.
- Brief `/chat` (list) → actual `/chats`. Add `/chat` redirect to `/chats` to satisfy walk-through.
- Brief `/rentals/bookings` → actual `/rentals/bookings/mine`. Add `/rentals/bookings/page.tsx` redirect to `/mine`.

### Phase A capture commands (run sequentially, output to plan §A under "Baseline metrics")

```bash
pnpm type-check 2>&1 | tail -5
pnpm lint 2>&1 | tail -5
pnpm --filter @smartshaadi/api test 2>&1 | tail -10   # expect ~310 passing
pnpm --filter @smartshaadi/web test 2>&1 | tail -10
pnpm --filter @smartshaadi/api build 2>&1 | tail -5
pnpm --filter @smartshaadi/web build 2>&1 | tail -5
ls -la packages/db/seed/
docker compose ps
# row counts via psql or scripts/audit-seed.ts
```

---

## §B — Issue Triage

### Must-fix (blocks demo)

| # | Issue | Files | Approach |
|---|---|---|---|
| B1 | Final exhaustive grep for `userId`-as-`profileId` violations | `apps/api/src/**/*.ts` | grep `eq(.*\.profileId, .*userId)` + visual review of 5 hits; fix any live offender at service boundary |
| B2 | Reshape `GET /api/v1/weddings/:id/budget` | `apps/api/src/weddings/router.ts:258-270`, `wedding.service.ts`, new test | Return `{ total, allocations: { decor, catering, photography, venue, music, misc }, spent, remaining }`; integration test |
| B3 | Polish empty states on demo-visible routes | 28 routes (see §D) | Reuse `EmptyState` from `apps/web/src/components/shared/EmptyState.tsx` — confirmed present |
| B4 | Indian locale formatting | New `apps/web/src/lib/format.ts` + migrate inline call sites | `formatINR` (lakhs grouping), `formatDateIN` (en-IN), `formatPhoneIN` |
| B5 | `USE_MOCK_SERVICES=true` banner | New `apps/web/src/components/shared/MockBanner.tsx` mounted in 3 layouts | Reads `process.env.NEXT_PUBLIC_USE_MOCK_SERVICES` (server-side env or NEXT_PUBLIC_ shim) |
| B6 | Translate button on chat | `apps/web/src/app/chat/[matchId]/ChatView.client.tsx` | Wire to existing `POST /api/v1/chat/translate` |
| B7 | "Mock" label on video room | `apps/api/src/lib/dailyco.ts` (return `isMock`) + `apps/web/src/components/video/VideoCall.client.tsx` (render badge) | Pass-through flag |

### Defer (document only)

- Daily.co real video — add badge "Mock video room — real Daily.co flips on with API key"
- Real Razorpay webhook — flagged in `CLIENT-WHATSAPP-SUMMARY.md` (5 days post-signing)
- DigiLocker / MSG91 — flagged in same summary

---

## §C — Seed Build (REVISED — minimum viable for 15–20 min flow)

**Drop + rebuild.** Wipe `apps/api/.data/mockStore.json`, truncate seeded tables, repopulate with 14 brief personas on `+91 99999 ...` prefix. Idempotent (`onConflictDoNothing()` on every insert). New `pnpm db:reseed` script in root `package.json`.

### Personas (14 users)

| Role | Name | Phone | Notes |
|---|---|---|---|
| INDIVIDUAL bride | Priya Khanna | +91 99999 00001 | 27, Delhi, Punjabi Hindu, Software PM Microsoft, IIT Delhi, father retired Army Colonel, vegetarian, Tula/Chitra/non-manglik, Safety Mode ON, 4 photos, 92% complete |
| INDIVIDUAL groom | Arjun Malhotra | +91 99999 00002 | 30, Delhi, Punjabi Hindu, IB VP Goldman Sachs, IIM-A, Mesha/Bharani/non-manglik, 5 photos, 96% complete, Guna 28/36 with Priya |
| FAMILY_MEMBER | Sunita Khanna | +91 99999 00003 | Linked to Priya |
| VENDOR · DECOR | Royal Decor (Meera Iyer) | +91 99999 00010 | Verified, ₹50k–2L |
| VENDOR · CATERING | Tandoor Tales (Rohit Kapoor) | +91 99999 00011 | Verified, ₹800–1500/plate |
| VENDOR · PHOTOGRAPHY | Lens & Light Studios (Vikram Singh) | +91 99999 00012 | Verified, ₹1.5L–4L |
| VENDOR · PRIEST | Acharya Rameshwar | +91 99999 00013 | Verified, ₹15k–35k/ceremony |
| VENDOR · CLOTHING | Asha Boutique (Asha Gupta) | +91 99999 00014 | Unverified, Mumbai |
| VENDOR · MUSIC | Beats Brigade (DJ Aman) | +91 99999 00016 | Unverified, Delhi |
| EVENT_COORDINATOR | Plan & Pamper (Neha Reddy) | +91 99999 00020 | Cross-vendor |
| ADMIN | Admin User | +91 99999 00099 | Platform admin |
| SUPPORT | Support Agent | +91 99999 00098 | KYC + dispute review |
| INDIVIDUAL spare 1 | Vikram Sinha | +91 99999 00050 | Spare for match feed |
| INDIVIDUAL spare 2 | Karan Mehta | +91 99999 00051 | Spare for match feed |

All `kyc_verifications` rows = VERIFIED. OTP `123456` keeps working (env `MOCK_OTP_VALUE=123456`).

### Seed file ownership

| Sub-seed | New file | Entities |
|---|---|---|
| Users + KYC | `packages/db/seed/users.ts` | 14 `user` rows + 14 `profiles` rows + 14 `kyc_verifications` (VERIFIED) |
| Priya & Arjun deep + 12 candidates | `packages/db/seed/profiles.ts` (rewrite) | Postgres `profiles` rich fields + `profile_photos` (4 for Priya, 5 for Arjun, 2-3 each candidate; URL = null → initials avatars only) |
| Mongo seed (profile content + chat + vendor portfolios) | `packages/db/seed/mongo.ts` | `profiles_content` for Priya/Arjun/12 candidates · `chats` for Priya×Arjun · `vendor_portfolios` for 6 vendors |
| 12 male match candidates + match scores | `packages/db/seed/matches.ts` | 12 male profiles (4 Delhi/3 Mumbai/2 Bangalore/1 Pune/1 Hyderabad/1 NRI; ages 26-34; 5 Punjabi/2 Marwari/2 Tamil Brahmin/1 Sindhi/1 Bengali/1 Sikh; income ₹15L-80L; 3 manglik/9 non-manglik). Guna 12-34/36 spread (Arjun 28, top 34, low 13). 4 paused. 1 ACCEPTED (Priya→Arjun, 7d ago) + 2 PENDING incoming for Priya. Pre-compute Guna TS-side mirroring `apps/ai-service/routers/horoscope.py` |
| Vendors + services + reviews | `packages/db/seed/vendors.ts` (rewrite) | 6 vendors × 3 services each, 3 reviews each, picsum.photos URLs |
| Wedding (Priya × Arjun, Dec 5 2026) | `packages/db/seed/weddings.ts` | 1 weddings row + budget JSON (Decor 3L, Catering 8L, Photography 2.5L, Venue 6L, Music 1L, Clothing 1.5L, Jewellery 2L, Misc 1L = ₹25L; spent ₹6.2L) + 7 ceremonies (Roka/Engagement DONE; Haldi/Mehendi/Sangeet/Wedding/Reception PLANNED) + 30 wedding_tasks (12 DONE/6 IN_PROGRESS/11 PENDING/1 OVERDUE) + 4 wedding_vendor_assignments |
| Guests | `packages/db/seed/guests.ts` | 50 guests (30 YES/8 NO/6 MAYBE/6 PENDING; mix VEG/NON_VEG/JAIN/EGGETARIAN; 12 plus-ones; 18 with rooms RM-101..RM-118) |
| Notifications | `packages/db/seed/notifications.ts` | 8 for Priya (3 unread): match accepted, new message, booking confirmed, payment received, mehendi reminder, sangeet confirmed, profile completeness, RSVP received |
| Orchestrator | `packages/db/seed/index.ts` (rewrite) | users → profiles → matches → vendors → weddings → guests → notifications → mongo. Idempotent. |
| Reset | Root `package.json` `db:reseed` script | `node packages/db/seed/wipe.ts && pnpm db:push && pnpm db:seed` |

### Critical conventions
- Resolve `userId → profileId` at every boundary via top-of-file helper.
- `onConflictDoNothing()` on every insert.
- Initials avatars only (`profile_photos.url = null`).
- Pre-compute Guna scores TS-side (Python service may not be running during seed).
- `audit_logs` not seeded (dispute flow out of scope).
- Mongo seed `if (!process.env.MONGODB_URI) return;` + dual-write to `apps/api/.data/mockStore.json`.

**Cut from original brief:** match_request DECLINED/BLOCKED variants, lukewarm + blocked chat conversations (only 1 active chat now), all e-commerce (products/orders), all rentals (rental_items/rental_bookings), audit_logs chained-hash, all booking states (DEMO-001..006), public RSVP token, invitations table, vendor #6 (Diamond Dazzle, Mumbai jewellery — drop to 6 vendors).

## §C — Seed Build (file ownership map) [ARCHIVED — replaced above]

Drop existing seed under `packages/db/seed/`; replace with split-by-domain layout:

| Brief sub-seed | New file | Entities |
|---|---|---|
| C1 — 12 candidate match feed | `packages/db/seed/matches.ts` | 12 male profiles, `match_scores` rows (Guna 12–34, Arjun=28, top=34, low=13), reciprocal partner prefs, 4 paused |
| C2 — Priya & Arjun deep | `packages/db/seed/profiles.ts` (rewrite) + `packages/db/seed/mongo.ts` | Postgres `profiles` + Mongo `profiles_content` rich payload (horoscope, family, hobbies) |
| C3 — Match request spread | `packages/db/seed/matches.ts` | 1 ACCEPTED, 2 PENDING (incoming), 1 SENT (outgoing), 1 DECLINED, 1 BLOCKED |
| C4 — Chat seed (Mongo) | `packages/db/seed/mongo.ts` | 3 conversations: active 18-msg, lukewarm 4-msg, blocked 2-msg |
| C5 — Vendors + portfolios + reviews | `packages/db/seed/vendors.ts` + `packages/db/seed/mongo.ts` | 7 vendors, 3-5 services each, `vendor_portfolios` Mongo, 3-5 reviews, 4 verified / 3 not |
| C6 — Bookings (state spread) | `packages/db/seed/bookings.ts` | DEMO-001..006 with `audit_logs` chained-hash entries |
| C7 — Wedding (Priya × Arjun Dec 2026) | `packages/db/seed/weddings.ts` | weddings row + budget JSON + 7 ceremonies + 30 wedding_tasks + 4 wedding_vendor_assignments |
| C8 — Guests + RSVP | `packages/db/seed/guests.ts` | 50 guests, 40 invitations, 1 public `rsvp_tokens` row |
| C9 — Store | `packages/db/seed/store.ts` | 15 products, 5 orders (incl. cancelled), order_items with `unit_price` snapshot |
| C10 — Rentals | `packages/db/seed/rentals.ts` | 8 rental_items, 2 rental_bookings (1 active, 1 historical) |
| C11 — Notifications | `packages/db/seed/notifications.ts` | 10 for Priya, 5 each for Arjun/Royal Decor/Admin |
| Auth/users + family | `packages/db/seed/users.ts` | 14 users + 14 `profiles` rows + 14 `kyc_verifications` (VERIFIED) |
| Orchestrator | `packages/db/seed/index.ts` (rewrite) | Idempotent; calls all sub-seeds in dependency order; uses `onConflictDoNothing` |
| Reset entrypoint | New root `package.json` script `db:reseed` | `drizzle-kit drop --force && drizzle-kit push && pnpm db:seed` |

**Critical conventions (do not violate):**
- Every seed function takes `profileId`, never `userId`, when writing to a `profiles.id`-keyed column.
- Use a small `resolveProfileIdByUserId(userId)` helper at top of each seed file, called once after user creation.
- Idempotent: `onConflictDoNothing()` on every insert; running twice is a no-op.
- Pre-compute Guna scores TS-side (mirror Python algorithm) — the Python service may not be running during seed.
- Initials avatars only — set `profile_photos.url = null` and rely on `UserAvatar` fallback.
- `audit_logs.contentHash` chain: each row's `prevHash` = previous row's `contentHash`. Use existing helper from `apps/api/src/payments/service.ts:25,54`.

**Mongo seed entry point:** `packages/db/seed/mongo.ts` writes to `profiles_content`, `chats`, `vendor_portfolios`. Guarded with `if (!process.env.MONGODB_URI) return;` plus dual-writes to `apps/api/.data/mockStore.json` so `USE_MOCK_SERVICES=true` works without Mongo.

---

## §D — Landing Upgrade (REPLACED — luxury Indian matrimonial)

Aesthetic direction: luxury/refined, editorial, premium-bridal-magazine. NOT corporate SaaS, NOT dating-app. The 30-second test: a 55-year-old Indian parent should feel "this is for our family"; a 28-year-old urban Indian should feel "this is finally tasteful."

**Existing landing inventory** (already rich — UPGRADE in place, do NOT rebuild):

| Component | File | Current state |
|---|---|---|
| Page | `apps/web/src/app/(marketing)/page.tsx` | Composes 9 sections — no new page needed |
| Navbar | `components/marketing/Navbar.client.tsx` | Keep |
| Hero | `components/marketing/Hero.client.tsx` | **REDESIGN** — currently full-bleed Pexels bg with framer-motion Ken Burns; replace with asymmetric 60/40 layout + photo collage + Devanagari accent + mandala SVG decoration |
| StatsBar | `components/marketing/StatsBar.client.tsx` | Light polish — verify token usage |
| HowItWorks | `components/marketing/HowItWorks.tsx` | Polish to 4 steps with thin gold connector line |
| FeaturesGrid | `components/marketing/FeaturesGrid.tsx` | Refine to "Three Pillars" with custom hand-drawn-feel SVG marks (diya/couple-silhouette/mandap) |
| TrustSection | `components/marketing/TrustSection.tsx` | Keep, light polish |
| Testimonials | `components/marketing/Testimonials.tsx` | Polish — gold corner ornaments, Playfair italic quotes |
| Pricing | `components/marketing/Pricing.tsx` | Hide via DEMO_MODE flag (out of scope for 15-20 min flow) |
| CtaBanner | `components/marketing/CtaBanner.tsx` | Polish — deep-burgundy bg, Playfair, gold mandala behind, Teal CTA |
| Footer | `components/marketing/Footer.tsx` | Keep |
| Photos source | `lib/marketing-images.ts` | Pexels CDN, already in `next.config.ts` `images.remotePatterns` |

**New components/sections to add:**

| New section | New file | Content |
|---|---|---|
| Every Ceremony band | `components/marketing/CeremoniesBand.tsx` | 5-7 ceremony cards (Roka, Mehendi, Sangeet, Haldi, Wedding, Reception) — small photo + Playfair name + 1-line Inter description; ivory-darker (#F8F5F0) band |
| Vendors families trust | `components/marketing/VendorsPreview.tsx` | 2x3 grid of seeded vendor preview cards (Royal Decor, Tandoor Tales, Lens & Light, Acharya, Asha, Beats) — portrait photo + Playfair name + gold category tag + ★ rating + "Starting from ₹X" + "Browse all verified vendors" CTA → `/vendors` |
| Mandala SVG decoration | `components/marketing/MandalaAccent.tsx` | Server component, inline SVG, opacity 0.05–0.08, used by Hero + CtaBanner backgrounds |

### Hero redesign spec (centerpiece — most of Phase D time)

- **Layout:** asymmetric two-column on desktop (60/40), stacked on mobile
- **LEFT 60%:**
  - Eyebrow line — `EST. 2026 · INDIA` in gold uppercase tracking-wide, small
  - Headline — Playfair Burgundy two lines; second line italic with gold underline. Suggestion: *"Where families find / their forever."* (NOT "Find Your Soulmate" / "Begin Your Journey")
  - Subheadline — Inter ~18px muted charcoal, max 220 chars
  - Primary CTA — Teal "Start your journey" `min-h-[48px] rounded-lg`
  - Secondary text link — Burgundy "Watch the 2-min walkthrough"
  - Trust strip — gold-bordered row, 4 trust badges separated by gold dots: "Verified Profiles · Safety Mode · Vedic Compatibility · Family-Led"
- **RIGHT 40%:** asymmetric photo collage — primary large portrait photo (Indian bride/couple at mandap) + smaller offset top-right (mehendi hands / gold jewelry / rangoli) + smaller offset bottom-left (couple laughing). All `rounded-2xl`, 2px gold border, soft shadow.
- **Photography:** prefer existing `marketing-images.ts` Pexels constants (`HERO_BG`, `FEATURE_GUNA_MILAN`, `TESTIMONIAL_*`); add new Pexels IDs as needed (host already in `next.config.ts` remotePatterns).
- **Decorative bg:** mandala SVG (opacity 0.05–0.08), large, partially off-canvas top-right + bottom-left. Subtle SVG-noise grain at 0.03 opacity for atmosphere. NO solid flat colour blocks.
- **Devanagari accent:** the word **विवाह** (vivaah, marriage) in Noto Serif Devanagari, large, gold, opacity 0.15, behind the headline as decorative element.
- **Motion:** staggered reveal on first paint — eyebrow (0ms) → headline lines (100ms, 250ms) → subheadline (400ms) → CTAs (550ms) → photo collage scale-in 0.96→1 + fade (700ms). Total < 1s. CSS-only via `animation-delay` (or framer-motion if reusing existing). `prefers-reduced-motion` respected.

### Three pillars refinement

Three cards in a row (stack mobile). Ivory bg, gold 1px border, `rounded-xl`, `p-7`, soft shadow. Replace generic Lucide icon top with stylised hand-drawn-feel SVG mark — diya/lamp (trust), couple-silhouette (matchmaking), mandap (planning); Burgundy stroke 32px. Playfair heading Burgundy, Inter body muted.

Cards:
1. **Verified Matchmaking** — "Reciprocal compatibility, Vedic Guna Milan across 8 Ashtakoot factors, and Safety Mode that hides contact details until both families are comfortable."
2. **End-to-End Planning** — "Multi-ceremony wedding planner — Roka, Sangeet, Mehendi, Wedding, Reception — with budget tracking, Muhurat suggestions, and 50+ guest list."
3. **Trusted Vendors** — "Verified photographers, decorators, caterers, priests, and stylists with portfolios, reviews, and a booking system that protects both sides."

### Closing CTA polish (CtaBanner.tsx)

- Full-width band, deep-burgundy bg `#5C2032` (or token-derived darker primary)
- Playfair heading in ivory: *"A wedding worth waiting for. A platform worth trusting."*
- Inter subheading muted ivory
- Teal CTA "Begin Your Journey" → `/login`
- Gold mandala SVG faint behind (reuse `MandalaAccent`)

### Hard constraints (Phase D)

- All sections Server Components unless interaction needed (Hero stays `.client` for framer-motion; new sections SC)
- Mobile-first 375px, NO horizontal scroll, all touch targets ≥44px
- Theme tokens only (`bg-primary`, `text-teal`, `border-gold`, `bg-background`) — NO hardcoded hex outside `@theme` block
- `pnpm --filter @smartshaadi/web build` zero errors
- `next/image` for all photos with `width`/`height`/`sizes`; `priority` on hero only
- **TIMEBOX 2 HOURS** — quality over completeness. If running over: ship Hero + 3 Pillars + Closing CTA polished; defer Ceremonies band / Vendors preview / Testimonials ornaments.

## §D — UI Polish Pass [ARCHIVED — replaced above]

For each route: confirm at 375px + 1280px, run Quality Check from `.claude/commands/ui-component.md`, log fix to `docs/smoke-test-2026-05-09.md`.

### New pages to create

| Route | New file |
|---|---|
| `/chat` (redirect) | `apps/web/src/app/(app)/chat/page.tsx` → redirects to `/chats` |
| `/weddings/[id]/ceremonies` | `apps/web/src/app/(app)/weddings/[id]/ceremonies/page.tsx` (lift section out of overview page) |
| `/weddings/[id]/muhurat` | `apps/web/src/app/(app)/weddings/[id]/muhurat/page.tsx` (lift section out) |
| `/rentals/bookings` | `apps/web/src/app/(app)/rentals/bookings/page.tsx` → redirects to `/rentals/bookings/mine` |

### Touchpoints by polish category

| Polish | Files (representative) |
|---|---|
| Indian formatting (B4) — replace inline `Intl.NumberFormat` and date strings | `dashboard/page.tsx`, `bookings/page.tsx`, `weddings/[id]/budget/page.tsx`, `store/orders/page.tsx`, `vendors/[id]/page.tsx`, `vendor-dashboard/page.tsx`, all booking/order detail pages |
| Mock banner mount (B5) | `apps/web/src/app/(app)/layout.tsx`, `(auth)/layout.tsx`, `(marketing)/layout.tsx` |
| Translate toggle (B6) | `apps/web/src/app/chat/[matchId]/ChatView.client.tsx` |
| Mock-video badge (B7) | `apps/web/src/components/video/VideoCall.client.tsx` |
| Empty state polish (B3) | `matches/page.tsx`, `chats/page.tsx`, `vendors/page.tsx`, `weddings/[id]/guests/page.tsx`, `weddings/[id]/tasks/page.tsx`, `store/page.tsx`, `store/orders/page.tsx`, `rentals/page.tsx`, `vendor-dashboard/*`, `admin/page.tsx` |
| Skeleton states | Reuse `CardListSkeleton`, `ProfileDetailSkeleton`, `TableSkeleton` from `components/shared/` (already present) |

### Reuse inventory (confirmed present — do NOT rebuild)

- `apps/web/src/components/shared/Avatar.tsx` (`UserAvatar` + initials fallback)
- `apps/web/src/components/shared/EmptyState.tsx`
- `apps/web/src/components/shared/Skeleton.tsx`, `CardListSkeleton.tsx`, `ProfileDetailSkeleton.tsx`, `TableSkeleton.tsx`
- Tailwind v4 tokens `bg-primary` (Burgundy), `bg-teal`, `bg-gold` in `globals.css:112-117`
- `EmptyState` already used in `dashboard/page.tsx` — copy that pattern

---

## §E — Hide Rough Edges (REPLACED — DEMO_MODE flag + nav guard)

1. **Env flag:** add `NEXT_PUBLIC_DEMO_MODE=true` to `apps/web/.env.local` (create file if absent; do not commit secrets).
2. **Nav guard — sidebar / bottom nav:** filter out the following routes when `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`:
   - `/store`, `/store/orders`, `/rentals`, `/rentals/bookings`, `/admin`, `/vendor-dashboard`
   - Keep visible: Dashboard, Matches, Chat, Vendors, My Wedding, Profile.
   - Find sidebar/bottom-nav at: search `apps/web/src/components` for `Sidebar`, `BottomNav`, `MainNav`. Apply guard there.
3. **Wedding tabs guard:** in `weddings/[id]/layout.tsx` (or wherever tab nav lives), hide Escrow + Payments tabs when `DEMO_MODE=true`. Keep: Overview, Tasks, Budget, Guests, Ceremonies, Muhurat, Vendors.
4. **Demo pill:** REPLACE the full-width `MockBanner` (Phase B B5) with a subtle floating pill bottom-right — gold border, ivory bg, 12px text: *"Demo Mode · OTP 123456 · Test card 4111-1111-1111-1111"*. Renders only when `NEXT_PUBLIC_DEMO_MODE=true`. New file `apps/web/src/components/shared/DemoPill.tsx`. Mount in root `app/layout.tsx`. Remove existing `<MockBanner />` from root layout.
5. **Translate tooltip:** add tooltip on the chat translate toggle (Phase B B6): *"Hindi-English translation — preview (full integration in next phase)"*. File: `apps/web/src/components/chat/ChatView.client.tsx`.
6. **Format helpers:** verify `apps/web/src/lib/format.ts` (Phase B B4) exports — `formatCurrency` (₹ with Indian numbering, e.g. 1,50,000), `formatDate` (en-IN '14 Apr 2026'), `formatPhone` ('+91 99999 00001'). Aliases for B4's `formatINR`/`formatDateIN`/`formatPhoneIN`. If brief expects exact names `formatCurrency`/`formatDate`/`formatPhone`, add re-exports.

## §E — Demo Documentation [ARCHIVED — replaced above]

| Doc | Path | Source content |
|---|---|---|
| Demo flow (30-min) | `docs/PHASE-1-2-DEMO-FLOW.md` | T-30 prep, browser tab map, 8 phase blocks (0-3 / 3-8 / 8-12 / 12-18 / 18-23 / 23-28 / 28-30), recovery cheats |
| Walkthrough reference | `docs/PHASE-1-2-WALKTHROUGH.md` | 28 routes × feature/what-it-does/phase/status table + back-end pillar list + mocked-vs-live matrix |
| WhatsApp summary | `docs/CLIENT-WHATSAPP-SUMMARY.md` | Brief Phase E3 verbatim with date placeholders |
| Smoke-test log | `docs/smoke-test-2026-05-09.md` | Per-route table: route · viewport · issue · fix · status |
| ROADMAP update | `ROADMAP.md` | Tick Phase 1 + Phase 2 boxes that are now demo-visible |
| Status block update | `CLAUDE.md` | Phase 2 → COMPLETE (demo-ready); add 2026-05-09 line to Last session |
| Banner update | `docs/DEMO-SCRIPT.md` | Top banner pointing to PHASE-1-2-DEMO-FLOW.md as current |

---

## §F — One-page Runbook + Verification (REPLACED)

### Single doc

Create ONLY `docs/DEMO-RUNBOOK-STRICT.md`. Skip `PHASE-1-2-DEMO-FLOW.md`, `PHASE-1-2-WALKTHROUGH.md`, `CLIENT-WHATSAPP-SUMMARY.md`, `smoke-test-2026-05-09.md` — out of scope.

Runbook structure:
- **T-15 prep checklist** — `pnpm db:reseed`, boot api+web, `/health` green, open 4 browser tabs (T1 logged-out for landing, T2 Priya, T3 Arjun, T4 Royal Decor vendor view), demo pill visible, phone silent.
- **Minute-by-minute (15–20 min):**
  - 0–2 Landing — let hero land, slow scroll through pillars + ceremonies + vendors + testimonials, click CTA (T1)
  - 2–4 Auth flow — phone OTP `123456` (T1)
  - 4–7 Profile + Safety Mode (T2 Priya)
  - 7–11 Match flow with 28/36 Guna highlight on Arjun (T2 → T3)
  - 11–14 Chat + Hindi message + translation tooltip (T2 + T3)
  - 14–18 Vendor + Wedding overview, escrow/payments hidden (T2 + T4)
  - 18–20 Close strong
- **Recovery cheats** — OTP fail → use Tab 2 · chat slow → refresh · page error → "I'll note that, moving on"
- **Tab cheat sheet** — which tab does what

### Smoke routes (11 only)

Walk at 375px and 1280px:
1. `/` (landing — hero + 3 pillars + ceremonies + vendors + testimonials + CTA)
2. `/login`
3. `/dashboard`
4. `/profile/me` (or `/profiles/[priyaProfileId]`)
5. `/matches`
6. `/matches/[arjunId]` (or `/profiles/[arjunProfileId]`)
7. `/chat` (will redirect to `/chats` per Phase B existing — verify)
8. `/chat/[matchId]` (Priya × Arjun)
9. `/vendors`
10. `/vendors/[royalDecorId]`
11. `/weddings/[id]` (Priya & Arjun wedding)

For each: 200, renders seed, no console errors. Verify hero photographs render (not broken), mandala visible but subtle, stagger animation on first paint, Devanagari accent renders correctly.

### Verification commands

```bash
pnpm type-check
pnpm lint
pnpm --filter @smartshaadi/api test    # >= 546 (Phase B added 3)
pnpm --filter @smartshaadi/web build   # zero errors
docker compose ps                       # all 4 healthy

# Fresh-DB rebuild dry run
pnpm db:reseed                          # < 60s, idempotent on re-run
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 8
curl -sS http://localhost:4001/health    # 200
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003   # 200

# Stopwatch dry-run lands 15-20 min
```

### Local commit (do NOT push)

```bash
git add -A
git commit -m "feat(demo): strict 15-20 min flow — landing upgrade + reduced seed + nav guard + runbook"
```

### Final summary block (print at end)

- Tests passing (delta vs 543 baseline)
- 11/11 smoke routes verified
- Files changed count
- Commit SHA
- One-line "ready to demo" or "blockers: …"

## §F — Verification Checklist [ARCHIVED — replaced above]

```bash
# 1. Type-check + lint + tests (zero errors / zero failures)
pnpm type-check
pnpm lint
pnpm --filter @smartshaadi/api test    # >= 311 (310 + budget GET test)
pnpm --filter @smartshaadi/web test

# 2. Fresh-DB rebuild dry run
docker compose down -v && docker compose up -d
sleep 6
pnpm db:push
pnpm db:seed     # < 60s, idempotent on re-run
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 8
curl -sS http://localhost:4001/health    # 200
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003   # 200

# 3. Manual smoke — log Priya in, walk every route, document in smoke-test-2026-05-09.md
#    Each route: 200, renders seeded data, no console errors, 375px + 1280px clean

# 4. Stopwatched demo dry-run — should land < 30 min following PHASE-1-2-DEMO-FLOW.md

# 5. Production builds
pnpm --filter @smartshaadi/api build
pnpm --filter @smartshaadi/web build

# 6. Local commit (do NOT push)
git add -A
git commit -m "feat(demo): phase 1+2 demo prep — seed, polish, docs"
```

### Acceptance criteria (final summary block)

- [ ] `pnpm type-check && pnpm lint && pnpm test` all green
- [ ] `pnpm db:reseed` rebuilds in < 60s
- [ ] All 28 demo routes 200 + render seed + zero console errors at 375px and 1280px
- [ ] Mock-mode banner visible on every page
- [ ] ₹ + Indian grouping + en-IN dates + `+91 XXXXX XXXXX` consistent
- [ ] Public RSVP token works
- [ ] DEMO-001 dispute flow: raise → admin resolve → refund → audit log shows chained-hash row
- [ ] Loom-able 30-min flow reproducible from `PHASE-1-2-DEMO-FLOW.md`
- [ ] All 4 docs written
- [ ] Single local commit, no push

---

## Execution sequence (sequential — summarize each phase as it lands)

1. **Phase 0 (≤ 5 min):** copy this plan to `docs/superpowers/plans/2026-05-09-phase1-2-demo-prep.md`. Capture phase-A baseline numbers in §A "Baseline metrics" subsection.
2. **Phase A (15 min):** run baseline commands; record numbers; no code changes.
3. **Phase B (60 min):** B1 grep, B2 budget endpoint + test, B4 format util, B5 mock banner, B6 translate button, B7 mock-video badge. Skip B3 empty-state polish until after seed (Phase D).
4. **Phase C (4-6 h):** seed split + Mongo seed + orchestrator + `db:reseed` script. Run `pnpm db:reseed` end-to-end, verify counts.
5. **Phase D (2-3 h):** new 4 pages + 28-route polish pass + smoke log.
6. **Phase E (60 min):** 4 new docs + update `ROADMAP.md` / `CLAUDE.md` / `DEMO-SCRIPT.md` banner.
7. **Phase F (30 min):** verification checklist + final summary block + local commit.

Total estimate: 8–11h work. Cap each phase at 1.5× estimate; if over, stop, summarize, ask before continuing.

---

## Critical files to be modified

**API (Phase B + C):**
- `apps/api/src/weddings/router.ts:258-270` (budget GET reshape)
- `apps/api/src/weddings/wedding.service.ts` + new test
- `apps/api/src/lib/dailyco.ts` (`isMock` flag)

**Web (Phase B + D):**
- New: `apps/web/src/lib/format.ts`
- New: `apps/web/src/components/shared/MockBanner.tsx`
- New: `apps/web/src/app/(app)/chat/page.tsx` (redirect)
- New: `apps/web/src/app/(app)/weddings/[id]/ceremonies/page.tsx`
- New: `apps/web/src/app/(app)/weddings/[id]/muhurat/page.tsx`
- New: `apps/web/src/app/(app)/rentals/bookings/page.tsx` (redirect)
- Edit: `apps/web/src/app/(app)/layout.tsx`, `(auth)/layout.tsx`, `(marketing)/layout.tsx` (banner mount)
- Edit: `apps/web/src/app/chat/[matchId]/ChatView.client.tsx` (translate toggle)
- Edit: `apps/web/src/components/video/VideoCall.client.tsx` (mock badge)
- Edit: ~10 (app) pages with inline `Intl.NumberFormat` → `formatINR`

**DB (Phase C):**
- Rewrite: `packages/db/seed/index.ts`
- Rewrite: `packages/db/seed/auth.ts` → split into `users.ts`
- Rewrite: `packages/db/seed/profiles.ts`
- Rewrite: `packages/db/seed/vendors.ts`
- Rewrite: `packages/db/seed/bookings.ts`
- New: `packages/db/seed/{matches,weddings,guests,store,rentals,notifications,mongo}.ts`
- Edit: root `package.json` (`db:reseed` script)

**Docs (Phase E):**
- New: `docs/PHASE-1-2-DEMO-FLOW.md`
- New: `docs/PHASE-1-2-WALKTHROUGH.md`
- New: `docs/CLIENT-WHATSAPP-SUMMARY.md`
- New: `docs/smoke-test-2026-05-09.md`
- Edit: `ROADMAP.md`, `CLAUDE.md`, `docs/DEMO-SCRIPT.md`

---

## Constraints (hard)

- Personas locked: Priya Khanna, Arjun Malhotra, Royal Decor, Tandoor Tales, Lens & Light, Acharya Rameshwar, Asha Boutique, Diamond Dazzle, Beats Brigade, Plan & Pamper, Sunita Khanna, Admin User, Support Agent.
- `USE_MOCK_SERVICES=true` stays on through demo.
- OTP `123456` must keep working — env `MOCK_OTP_VALUE=123456`.
- `userId` → `profileId` resolution at boundary; never pass `userId` to a `profiles.id`-keyed column.
- No real face photos — initials avatars only.
- No plan approval mode for any subagent (WSL idle deaths).
- `tsx watch` can die on `/mnt/d/` — restart API manually after Phase C seed.
- Local commit only; no push.
- Do not introduce Phase 3 stubs visibly.
