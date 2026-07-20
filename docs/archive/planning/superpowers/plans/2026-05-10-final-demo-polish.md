# Final Demo Polish — 2026-05-10 (FRESH PLAN, supersedes 2026-05-09)

> **In execution Phase 0**, mirror this file to `docs/superpowers/plans/2026-05-10-final-demo-polish.md` (harness restricts in-plan edits to this file only).

## Context

Tomorrow evening Ashwin demos Phases 1+2 to Colonel Deepak. Strict 7-part 15-20 min flow: Landing → Auth → Profile + Safety → Match → Chat → Vendor + Wedding → Close. Yesterday's session (commit `2e148b7`) shipped half the pre-work — demo-mode flag is already live. Today's mission: backfill the seed gap, world-class landing upgrade, polish 11 routes, write runbook + WhatsApp summary, single local commit. Polish over scope. Visible over hidden.

---

## §A — Baseline (CAPTURED in this session, READ-ONLY done)

### Git state (last 36h)
- `2e148b7` chore(demo): demo-mode flag + crash fixes ← **yesterday's headline work**
- `a9d4d05` chore(diag): fix-caste-income.js
- `8827292` feat(matchmaking): /feed?refresh=1 cache bypass
- Working tree clean except `?? docs/superpowers/plans/final-demo-polish-prompt.md` (today's brief, untracked)

### Already shipped (do NOT re-do)
- `apps/web/.env.local` → `NEXT_PUBLIC_DEMO_MODE=true` ✅
- `apps/web/src/components/shared/DemoPill.tsx` (floating pill bottom-right) ✅
- `apps/web/src/components/layout/AppNav.client.tsx` → `filterForDemo()` hides `/store /rentals /admin /vendor-dashboard` ✅
- `apps/web/src/lib/format.ts` (formatINR/formatDateIN/formatPhoneIN/etc) ✅
- chat translate toggle in `ChatView.client.tsx` ✅
- `MockBanner.tsx` deleted, replaced with DemoPill in root layout ✅
- `weddings/:id/budget` GET reshape + 3 tests (546/546 API tests passing) ✅
- video `isMock` flag end-to-end ✅

### Current Postgres row counts (LIVE — local docker)
| Table | Now | Target | Gap |
|---|---|---|---|
| user | 15 | ≥14 | OK |
| profiles | 14 | ≥26 | +12 candidates |
| vendors | 3 | 6 | +3 |
| match_scores | **0** | 12 | +12 |
| match_requests | 4 | ≥4 | OK |
| weddings | 5 (stale/garbage) | 1 (Priya×Arjun) | wipe + 1 |
| wedding_tasks | 19 | ≥30 | +11 |
| guests | 4 | ≥50 | +46 |
| notifications | **0** | ≥8 | +8 |

### Existing personas (locked phone convention `+9188888800XX`)
```
+918888880001  Priya Sharma     INDIVIDUAL  ← rename surname → Khanna (per brief + memory note 5236)
+918888880002  Rahul Verma      INDIVIDUAL  ← rename → Arjun Malhotra (the demo groom)
+918888880003  Ananya Iyer      INDIVIDUAL
+918888880004  Vikram Patel     INDIVIDUAL
+918888880005  Test Vendor      VENDOR      ← becomes Royal Decor (Meera Iyer)
+918888880006  Test Admin       ADMIN
```
Brief allows preserving existing convention (§B: "If the existing seed uses different phone numbers, keep the existing convention"). Backfill on `+9188888800XX` series.

### Demo mode flag — already wired ✅
- Env var present
- `AppNav` guard active for both `primary` and `moreItems`
- DemoPill renders bottom-right
- **Phase E reduced to verification + tab guard for wedding [id] Escrow/Payments tabs only**

### Landing page reality (BRIEF PATH IS WRONG — note this)
- Lives at `apps/web/src/app/(marketing)/page.tsx` (NOT `apps/web/src/app/page.tsx`)
- 12 components @ 1691 lines already wired: `Navbar.client · Hero.client · StatsBar.client · HowItWorks · FeaturesGrid · TrustSection · Testimonials · Pricing · CtaBanner · Footer · AnimatedSection.client · Logo`
- **No `/public` photography directory exists** → use Unsplash CDN URLs in `next/image` with explicit IDs (extend `next.config.ts` `images.remotePatterns` if `images.unsplash.com` not yet allowed)
- Pricing component shipped → hide via DEMO_MODE in marketing page (out of scope for tomorrow)

### Route inventory (BRIEF ROUTE PATHS PARTIALLY WRONG)
| Brief says | Reality | Plan |
|---|---|---|
| `/` | `(marketing)/page.tsx` | upgrade in place |
| `/login` | `(auth)/login/page.tsx` | polish only |
| `/dashboard` | `(app)/dashboard/page.tsx` | polish only |
| `/profile/me` | **does not exist** | walk via `/profiles/[priyaProfileId]` |
| `/matches` | `(app)/matches/page.tsx` | polish |
| `/profile/[arjun-id]` | `/profiles/[profileId]` | polish |
| `/chat` (list) | `/chats` | polish |
| `/chat/[matchId]` | `/chat/[matchId]` | polish |
| `/vendors` | `/vendors` | polish |
| `/vendors/[id]` | `/vendors/[id]` | polish |
| `/weddings/[id]` | `/weddings/[id]` | polish |

### Schema gotchas (verified live)
- `profiles` has NO `full_name` column — names live in Mongo `profile_contents.personal.fullName`
- `vendors` uses `business_name` (NOT `name`)
- `weddings` has `bride_name`/`groom_name` text columns + `partner_profile_id` FK
- `profile_photos.url` doesn't exist; uses `r2Key` (initials avatar fallback when null) — per memory 5226

---

## §B — Backfill seed (60-90 min, gap-only)

### Identity decisions (locked)
- **Keep existing phones `+9188888800XX`** (brief allows; memory 1482 confirms convention)
- **Rename:** Priya Sharma → **Priya Khanna**; Rahul Verma → **Arjun Malhotra**; Test Vendor → **Royal Decor (Meera Iyer)**
- **OTP `123456`** stays (env `MOCK_OTP_VALUE` defaults to it; memory S4684)
- **All photos = initials avatar** (no real face photos per user constraint); vendor portfolio images use `picsum.photos/seed/{slug}-{n}/800/600` (deterministic, free)

### Files to CREATE
| File | Purpose | Approx LOC |
|---|---|---|
| `packages/db/seed/_shared.ts` | `detUuid()` deterministic-UUID helper · persona phone→userId map · `findOrCreateUser()` boundary helper resolving `userId → profileId` | 80 |
| `packages/db/seed/wipe.ts` | Truncate-with-cascade `weddings ceremonies wedding_tasks guests notifications match_scores match_requests vendor_services vendors` (preserve `user`/`profiles` to keep auth IDs stable) — idempotent | 60 |
| `packages/db/seed/users.ts` | Backfill missing personas (Sunita Khanna, 5 vendors, 12 candidates). Re-uses existing `user` rows where phone matches; `onConflictDoNothing()` everywhere | 200 |
| `packages/db/seed/matches.ts` | 12 male candidates pre-computed `match_scores` (Guna 12-34, Arjun=28, top=34) + reuse 4 existing `match_requests` (Priya↔Arjun ACCEPTED, 2 PENDING, 1 SENT) | 250 |
| `packages/db/seed/weddings.ts` | 1 wedding (Priya×Arjun, Dec 5 2026, The Imperial Delhi, ₹25L budget) + 7 ceremonies + 30 wedding_tasks + 4 wedding_vendor_assignments | 200 |
| `packages/db/seed/guests.ts` | 50 guests (30 YES/8 NO/6 MAYBE/6 PENDING; mix VEG/NON_VEG/JAIN; 12 plus-ones; 18 with rooms RM-101…RM-118) | 100 |
| `packages/db/seed/notifications.ts` | 8 for Priya (3 unread): match accept · message · 2 booking confirms · task due · profile milestone · acharya confirmed · order shipped | 60 |
| `packages/db/seed/mongo.ts` | Idempotent Mongo writes — `profile_contents` (Priya + Arjun + 12 candidates rich payload) · `chats` (1 conversation, 12 messages, 1 Hindi line) · `vendor_portfolios` (6 vendors, 4 portfolio items + 3 reviews each). Dual-writes to `apps/api/.data/mockStore.json` when `USE_MOCK_SERVICES=true` | 280 |

### Files to REWRITE
| File | Change |
|---|---|
| `packages/db/seed/index.ts` | Orchestrator: `wipe → users → vendors → matches → weddings → guests → notifications → mongo` (dependency-ordered, idempotent) |
| `packages/db/seed/profiles.ts` (294 lines) | Strip Mongo logic out (move to `mongo.ts`); keep nothing else, file collapses to re-export shim or delete |
| `packages/db/seed/vendors.ts` (81 lines) | Replace 1 generic vendor with 6 (Royal Decor · Tandoor Tales · Lens & Light · Acharya Rameshwar · Asha Boutique · Beats Brigade), 3 services each, 4 verified / 2 unverified |
| `packages/db/seed/auth.ts` (103 lines) | Rename Priya Sharma→Khanna, Rahul Verma→Arjun Malhotra; add Sunita Khanna FAMILY_MEMBER on `+918888880050` |
| `packages/db/seed/bookings.ts` (55 lines) | Out of scope tomorrow — no edit |
| Root `package.json` | Add `db:reseed` script: `"db:reseed": "node packages/db/seed/wipe.ts && pnpm db:push && pnpm db:seed"` |

### Critical conventions (NEVER violate — memory 5235, S4690)
1. Resolve `userId → profileId` at every boundary (`profiles.userId` is text → `profiles.id` is uuid). Top-of-file helper used once after user creation.
2. `onConflictDoNothing()` on every insert; running twice is a no-op.
3. Pre-compute Guna scores TS-side (mirror `apps/ai-service/routers/horoscope.py`) — Python service may not be running during seed.
4. `profile_photos.r2Key = null` → UserAvatar component renders initials.
5. Mongo seed guarded `if (!process.env.MONGODB_URI && !process.env.USE_MOCK_SERVICES) return;`

### Priya × Arjun deep payload (per brief §B)
- **Priya:** 27, Delhi, Punjabi Hindu, Software PM Microsoft, ₹35L, IIT Delhi B.Tech CS 2019, **father retired Army Colonel** (subtle Colonel Deepak rapport), vegetarian, hobbies trekking/reading/tabla/photography, DOB 1998-08-14 04:32 IST Delhi, rashi Tula, nakshatra Chitra, non-manglik, partner pref 28-32/5'9-6'2/Punjabi/₹>25L/Delhi-Mumbai, **Safety Mode ON**, 4 photos (initials), profile completeness 92%
- **Arjun:** 30, Delhi, Punjabi Hindu, IB VP Goldman Sachs, ₹65L, IIM-A MBA 2020, vegetarian, hobbies cricket/podcasts/travel/cooking, DOB 1995-11-22 09:15 IST Delhi, rashi Mesha, nakshatra Bharani, non-manglik, 5 photos (initials), profile completeness 96%, **Guna 28/36 hardcoded** (sweet spot)

### 12 candidates spread (visible variety on /matches)
4 Delhi · 3 Mumbai · 2 Bangalore · 1 Pune · 1 Hyderabad · 1 NRI USA. Ages 26-34. 5 Punjabi · 2 Marwari · 2 Tamil Brahmin · 1 Sindhi · 1 Bengali · 1 Sikh. Income ₹15L-80L. 3 manglik / 9 non-manglik. Guna 12-34/36 (Arjun 28, top 34, low 13). 4 paused/inactive (engaged-only filter demo).

### Chat seed (Mongo)
12 messages over 5 days, mostly English, ONE Hindi line "मेरी मम्मी कहती हैं कि आप बहुत अच्छे लगते हैं" on day 2. Last message "Looking forward to tomorrow!" 2h ago, unread by Arjun.

### Verify after seed
```bash
pnpm db:reseed   # < 90s, idempotent on re-run
PGPASSWORD=vivah psql -h localhost -U vivah -d smart_shaadi -c "
  SELECT (SELECT COUNT(*) FROM profiles) AS profiles,
         (SELECT COUNT(*) FROM vendors) AS vendors,
         (SELECT COUNT(*) FROM match_scores) AS match_scores,
         (SELECT COUNT(*) FROM weddings) AS weddings,
         (SELECT COUNT(*) FROM wedding_tasks) AS tasks,
         (SELECT COUNT(*) FROM guests) AS guests,
         (SELECT COUNT(*) FROM notifications) AS notifs;
"
# Expect: profiles>=26, vendors=6, match_scores>=12, weddings=1, tasks>=30, guests>=50, notifs>=8
```

---

## §C — Landing upgrade (3-hour HARD timebox, headline visible win)

**Aesthetic locked:** luxury / refined Indian matrimonial — auspicious, editorial, premium-bridal-magazine. NOT corporate SaaS / NOT dating-app / NOT generic Tailwind hero. The 30-second test: 55-year-old Indian parent feels "this is for our family"; 28-year-old urban Indian feels "finally tasteful."

**Tokens locked** (already in `globals.css` `@theme`): Burgundy `#7B2D42` · Gold `#C5A47E` · Teal `#0E7C7B` · Ivory `#FEFAF6` · Playfair Display · Inter · Noto Serif Devanagari.

**Strategy: upgrade in place** — `(marketing)/page.tsx` already composes 9 sections. Edit individual components, do not rebuild the page.

### Section ownership (which file each section lives in)
| Section | File | Action | Effort |
|---|---|---|---|
| 1. HERO | `Hero.client.tsx` (190 LOC) | **REDESIGN** asymmetric 60/40 + photo collage + Devanagari accent + mandala SVG bg + staggered motion | 60 min |
| 2. THREE PILLARS | `FeaturesGrid.tsx` (176 LOC) | refine to 3 cards + custom hand-drawn-feel SVG marks (diya/couple/mandap) Burgundy stroke 32px | 25 min |
| 3. EVERY CEREMONY band | **NEW** `CeremoniesBand.tsx` | 5-7 ceremony cards (Roka/Mehendi/Sangeet/Haldi/Wedding/Reception) on darker ivory `#F8F5F0` band | 25 min |
| 4. VENDORS FAMILIES TRUST | **NEW** `VendorsPreview.tsx` | 2x3 grid using seeded vendors → CTA `/vendors` | 25 min |
| 5. TESTIMONIALS | `Testimonials.tsx` (151 LOC) | polish — gold corner ornaments + Playfair italic quotes + India-context first names | 15 min |
| 6. HOW IT WORKS | `HowItWorks.tsx` (164 LOC) | 4-step horizontal stepper + thin gold connector line | 15 min |
| 7. CLOSING CTA | `CtaBanner.tsx` (70 LOC) | deep-burgundy `#5C2032` bg + Playfair ivory + Teal CTA + faint mandala bg | 10 min |
| 8. FOOTER | `Footer.tsx` (158 LOC) | minor polish only | 5 min |
| 9. (PRICING) | `Pricing.tsx` | hide via `NEXT_PUBLIC_DEMO_MODE` check in `(marketing)/page.tsx` | 2 min |
| Mandala SVG | **NEW** `MandalaAccent.tsx` | reusable Server Component, opacity 0.05-0.08, used by Hero + CtaBanner | 10 min |
| StatsBar | `StatsBar.client.tsx` (144) | light polish — verify token usage | 5 min |
| TrustSection | `TrustSection.tsx` (142) | keep | 0 |

### Hero spec (centerpiece — single biggest lift)
- **LEFT 60%:** eyebrow `EST. 2026 · INDIA` (gold uppercase tracking-wide) → headline Playfair Burgundy 2 lines: **"Where families find / *their forever.*"** (italic + gold underline accent on line 2; *not* "Find Your Soulmate"/"Begin Your Journey") → subheadline Inter 18px muted ≤220 chars → Teal CTA "Start your journey" → `/login` (min-h-48px) → secondary text link "Watch the 2-min walkthrough" → trust strip `Verified Profiles · Safety Mode · Vedic Compatibility · Family-Led` separated by gold dots
- **RIGHT 40%:** asymmetric photo collage — primary portrait Indian bride/couple at mandap (rounded-2xl, 2px gold border, soft shadow, slight 1-3deg rotation) + smaller offset top-right (mehendi hands or rangoli) + smaller offset bottom-left (couple laughing). Gold corner ornament SVGs on primary.
- **Photography:** Unsplash CDN `https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1200&q=80` with `next/image` priority on primary. Document exact IDs in component. Verify `next.config.ts` has `images.unsplash.com` in `remotePatterns` (memory says marketing-images.ts already used Pexels — extend if needed).
- **Decoration:** mandala SVG opacity 0.05-0.08 partially off-canvas top-right + bottom-left + subtle SVG-noise grain 0.03 + Devanagari **विवाह** in Noto Serif Devanagari opacity 0.15 large gold behind headline.
- **Motion (CSS-only, prefers-reduced-motion):** eyebrow 0ms → headline-1 100ms → headline-2 250ms → subheadline 400ms → CTAs 550ms → photo collage 700ms (scale 0.96→1 + fade). Total <1s.

### Constraints
- Server Components default; `Hero.client.tsx` stays client (motion); new sections SC unless interaction
- Mobile-first 375px, NO horizontal scroll, all touch targets ≥44px
- Theme tokens only (`bg-primary`/`text-teal`/`border-gold`) — NO hardcoded hex outside `globals.css` `@theme`
- `next/image` for every photograph with explicit `width`/`height`/`sizes`/`alt`
- `pnpm --filter @smartshaadi/web build` finishes zero errors
- **HARD TIMEBOX 3 HOURS.** If running over: ship Hero + 3 Pillars + Closing CTA polished, defer Ceremonies/Vendors/Testimonials section ornaments. The hero alone sells the upgrade.

---

## §D — Polish 11 strict-flow routes (90 min)

Walk each at 375px and 1280px. Apply `.claude/commands/ui-component.md` Quality Check. Document in `docs/smoke-test-2026-05-10.md` as table: Route · Viewport · Issue · Fix · Status.

### Routes + current state (from this session's audit)
| # | Route (real path) | Current state | Polish target |
|---|---|---|---|
| 1 | `/` | Phase C lands here | hero photos render, mandala visible, motion plays |
| 2 | `/login` | works (verified yesterday) | mock banner pill, OTP form, 44px touch |
| 3 | `/dashboard` | works (yesterday smoke 200) | 92% completeness · bookings count · unread · countdown · matches strip |
| 4 | `/profiles/[priyaId]` | exists | 5 tabs render, gold photo border, partner prefs, Safety Mode toggle ON |
| 5 | `/matches` | works | 12 cards · Guna colour bands red<17/amber 18-24/teal 25-32/green 33-36 · reciprocal filter on · 2 PENDING in inbox |
| 6 | `/profiles/[arjunId]` | exists | full Arjun · 8-koot expanded showing 28/36 · "Match Accepted" badge · contact unlocked |
| 7 | `/chats` | works | 1 conversation visible, unread badge on Arjun |
| 8 | `/chat/[matchId]` | works | 12 msgs · Hindi line renders · translate toggle preview tooltip · video CTA |
| 9 | `/vendors` | works | 6 vendors · filter Delhi+Decoration → Royal Decor · verified badges differentiated |
| 10 | `/vendors/[royalDecorId]` | exists | portfolio gallery 4 picsum · 3 services · 3 reviews · BOOK NOW Teal |
| 11 | `/weddings/[id]` | exists | countdown Dec 5 · 7 ceremony cards · budget donut · task progress · tabs (no Escrow/Payments per E.1) |

### What to fix on each
375px horizontal scroll · skeleton during fetch · empty-state polish · off-palette colour · `1,50,000` not `150,000` · `+91 99999 99999` phone · 44px touch · en-IN dates · Devanagari font where it should render · alt text on every img.

Format helpers already centralised in `apps/web/src/lib/format.ts` ✅ — just sweep for inline `Intl.NumberFormat` violations and replace with imports.

---

## §E — Demo-mode hide + runbook + WhatsApp (60 min)

### E.1 — Demo-mode flag (mostly done, verify + extend)
- ✅ `apps/web/.env.local` has `NEXT_PUBLIC_DEMO_MODE=true`
- ✅ `AppNav.client.tsx` filters `/store /rentals /admin /vendor-dashboard`
- ✅ `DemoPill.tsx` floating bottom-right with OTP `123456` + card `4111 1111 1111 1111`
- **TODO** — hide Escrow + Payments tabs on `weddings/[id]/layout.tsx` (or wherever wedding tab nav lives) when `DEMO_MODE=true`. Keep: Overview · Tasks · Budget · Guests · Ceremonies · Muhurat · Vendors. (Memory 5241 says no Escrow/Payments tab name found — re-grep wedding tab files; if literally absent, no-op.)
- **TODO** — hide Pricing component in `(marketing)/page.tsx` when `DEMO_MODE=true`

### E.2 — Translation toggle copy
Edit `ChatView.client.tsx` translate button — add tooltip: *"Hindi-English translation — preview (full integration in next phase)"*

### E.3 — `docs/DEMO-RUNBOOK-FINAL.md` (NEW, single page paste-ready)
Per brief §E.4 verbatim — T-15 prep · 4 browser tabs · 8 minute-by-minute blocks (Vision/Auth/Profile/Match/Chat/Vendor+Wedding/Close) · recovery cheats · tab cheat · don't list.

### E.4 — `docs/CLIENT-WHATSAPP-SUMMARY.md` (NEW)
Per brief §E.5 verbatim — Phase 1 ✅, Phase 2 ✅, mocks list, Phase 3 starts Monday.

---

## §F — Verify + commit (45 min)

```bash
pnpm type-check                                    # 8/8 packages clean
pnpm lint
pnpm --filter @smartshaadi/api test                # ≥546
pnpm --filter @smartshaadi/web build               # zero errors

# Fresh demo state — full reset
pnpm db:reseed                                     # < 90s

# Boot apps (memory: tsx watch dies on /mnt/d, use pnpm exec tsx if so)
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 10
curl -sS http://localhost:4000/health              # 200
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 200

# Authenticated 11-route smoke as Priya (+918888880001 OTP 123456)
# (use Better Auth phone-number/send-otp + phone-number/verify per memory S4686)
# Each route: HTTP 200 + no "Application error" in HTML + DemoPill rendered

# Stopwatch dry-run with runbook — must land 15-20 min

# Local commit (DO NOT push — user pushes manually)
git add -A
git commit -m "feat(demo): final polish for Colonel Deepak demo"
```

### Final summary block to print
- Tests: passing/total (delta vs 546 baseline)
- Routes: X/11 verified at 375px + 1280px
- Files changed count
- Commit SHA
- Stopwatch demo dry-run time
- Verdict: "Ready to demo" or "Blockers: …"

---

## Timeboxes (total: ~9-11h, hard caps)

| Phase | Hard cap | Stretch |
|---|---|---|
| 0 — mirror plan | 5 min | — |
| A — baseline | DONE in this session | — |
| B — backfill seed | 90 min | flag if >2h |
| C — landing upgrade | **3h HARD** | flag if >3.5h, ship hero+pillars+CTA only |
| D — polish 11 routes | 90 min | flag if >2h |
| E — demo-mode + docs | 60 min | flag if >75 min |
| F — verify + commit | 45 min | flag if >60 min |

If any phase exceeds cap by >20%, **pause and flag** — don't push through.

---

## Critical files

**Seed (CREATE):**
- `packages/db/seed/_shared.ts`
- `packages/db/seed/wipe.ts`
- `packages/db/seed/users.ts`
- `packages/db/seed/matches.ts`
- `packages/db/seed/weddings.ts`
- `packages/db/seed/guests.ts`
- `packages/db/seed/notifications.ts`
- `packages/db/seed/mongo.ts`

**Seed (REWRITE):**
- `packages/db/seed/index.ts` (orchestrator)
- `packages/db/seed/auth.ts` (rename surnames)
- `packages/db/seed/vendors.ts` (1→6 vendors)
- Root `package.json` (`db:reseed` script)

**Landing (EDIT in place):**
- `apps/web/src/app/(marketing)/page.tsx` (compose new sections + DEMO_MODE Pricing hide)
- `apps/web/src/components/marketing/Hero.client.tsx` (REDESIGN)
- `apps/web/src/components/marketing/FeaturesGrid.tsx` (3 pillars refine)
- `apps/web/src/components/marketing/CtaBanner.tsx` (deep burgundy + mandala)
- `apps/web/src/components/marketing/Testimonials.tsx` (gold ornaments)
- `apps/web/src/components/marketing/HowItWorks.tsx` (4-step gold stepper)

**Landing (CREATE):**
- `apps/web/src/components/marketing/CeremoniesBand.tsx`
- `apps/web/src/components/marketing/VendorsPreview.tsx`
- `apps/web/src/components/marketing/MandalaAccent.tsx`

**Polish:**
- `apps/web/src/components/chat/ChatView.client.tsx` (translate tooltip copy)
- `apps/web/src/app/(app)/weddings/[id]/layout.tsx` or tab component (Escrow/Payments hide)
- ~10 `(app)` pages with inline `Intl.NumberFormat` → `formatINR` from `lib/format.ts`

**Docs:**
- `docs/DEMO-RUNBOOK-FINAL.md` (NEW)
- `docs/CLIENT-WHATSAPP-SUMMARY.md` (NEW)
- `docs/smoke-test-2026-05-10.md` (NEW)
- `docs/superpowers/plans/2026-05-10-final-demo-polish.md` (mirror in Phase 0)

**Reused (do NOT rebuild):**
- `apps/web/src/lib/format.ts` (formatINR/formatDateIN/formatPhoneIN)
- `apps/web/src/components/shared/UserAvatar` (initials fallback)
- `apps/web/src/components/shared/EmptyState`
- `apps/web/src/components/shared/{Card,Table,ProfileDetail}Skeleton`
- `apps/web/src/components/layout/AppNav.client.tsx` (DEMO_MODE filter)
- `apps/web/src/components/shared/DemoPill.tsx`

---

## Constraints (hard)

- Existing personas locked: Priya, Arjun, Royal Decor, Tandoor Tales (first names; surnames Khanna/Malhotra per brief)
- Phone convention: keep existing `+9188888800XX` (brief allows; memory 1482)
- `USE_MOCK_SERVICES=true` stays through demo
- OTP `123456` keeps working (env `MOCK_OTP_VALUE` Zod-default)
- Resolve `userId → profileId` at every boundary (recurring bug — memory 5235)
- Initials avatars only, no real face photos — picsum for vendor portfolio bg only
- Phase C 3-hour HARD timebox; defer ceremonies/vendors/testimonials sections if running long
- Local commit only; **do NOT push** (Ashwin pushes manually)
- No Plan Approval Mode for any subagent (WSL idle deaths — feedback memory)
- `tsx watch` dies on `/mnt/d` — restart with `pnpm exec tsx src/index.ts` if API silent

---

## Verification (end-to-end test)

1. `pnpm db:reseed` rebuilds clean state in <90s, idempotent on re-run
2. `pnpm type-check && pnpm lint` zero errors
3. `pnpm --filter @smartshaadi/api test` ≥546
4. `pnpm --filter @smartshaadi/web build` zero errors
5. Boot apps; curl `/health` + landing returns 200
6. Authenticate as Priya → walk all 11 routes at 375px + 1280px → zero `Application error` in any rendered HTML
7. Verify hero photos render, Devanagari accent visible, mandala faintly behind, motion plays under 1s
8. Verify DemoPill bottom-right; verify `/store /rentals /admin /vendor-dashboard` absent from rendered nav HTML
9. Indian formatting consistent: `₹1,50,000` not `₹150,000`; `+91 88888 80001`; `5 Dec 2026`
10. Stopwatch demo dry-run with runbook lands 15-20 min
11. Single local commit, no push
