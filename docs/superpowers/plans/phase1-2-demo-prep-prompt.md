# CLAUDE CODE PROMPT — Phase 1 & 2 Demo Prep for Colonel Deepak

> **Paste this entire block into Claude Code in WSL.** It is one self-contained brief covering diagnostics, issue triage, seed expansion, UI polish, and the demo collateral Ashwin needs to walk Colonel Deepak through Phases 1 & 2. Plan first, wait for approval, then execute.

---

## Mission

Phases 1 and 2 are functionally complete (see `docs/phase2-qa-report.md` — 11 ✅, 4 ⚠️, 0 ❌, 310/310 tests passing). The platform now needs to **look and feel production-ready in a live walkthrough** for Colonel Deepak — every page must be data-rich, every empty state must be polished, every mocked external must be transparently labelled, and the demo flow must be tight enough to land the one-month milestone with confidence.

Outcome: by the end of this run, Ashwin can open `apps/web` on `http://localhost:3003`, log in as Priya, walk the demo end-to-end without any "uh, this is empty" moments, hand the Colonel a written summary, and screen-record a 7-minute Loom from the same environment.

---

## Read first (before writing the plan)

Read these docs in this order — **do not skim**, they encode promises already made to the client:

1. `docs/DEMO-SCRIPT.md` — 25-minute walkthrough, names Priya/Arjun/Royal Decor/Tandoor Tales/Booking #DEMO-001. **Align all new seed to these identities — do not rename.**
2. `docs/CLIENT-PRESENTATION.md` — slide deck source; demo is Pillar 1 (Slide 4) followed by hardening + activation roadmap.
3. `docs/phase2-qa-report.md` — confirms 11 features ✅, 4 ⚠️ (budget GET, RSVP live token, Daily.co video, real-match meetings, real-booking dispute). Three of those ⚠️ items can be cleanly shown via existing seed; one is genuinely external-blocked.
4. `docs/DAILY_PROMPTS.md` — Phase 2 Loom script Ashwin already drafted.
5. `packages/db/seed/` — current seed contents (3 users only per ROADMAP.md). This is the gap to close.
6. `apps/web/src/app/(app)/` — every demo-visible route. Especially `dashboard`, `matches`, `chat`, `weddings/[id]`, `vendors`, `vendor-dashboard`, `store`, `admin`.
7. `.claude/commands/ui-component.md` — design system rules. Every page touched in Phase D must pass the **Quality Check** at the bottom of that file.

---

## Output expectations

You will produce:

1. **Plan file** at `docs/superpowers/plans/2026-05-09-phase1-2-demo-prep.md` covering Phases A–F below, with file-level ownership and ordering.
2. **Seed expansion** in `packages/db/seed/` (split by domain: `users.ts`, `profiles.ts`, `matches.ts`, `chat.ts`, `vendors.ts`, `bookings.ts`, `weddings.ts`, `guests.ts`, `store.ts`, `rentals.ts`, `notifications.ts`, plus `index.ts` orchestrator).
3. **MongoDB seed** for profile content + chat messages + vendor portfolios — wired into the same `pnpm db:seed` command via `packages/db/seed/mongo.ts`.
4. **UI polish patches** for any demo route with broken empty states, missing skeletons, off-palette colour, or non-Indian formatting.
5. **`docs/PHASE-1-2-DEMO-FLOW.md`** — 30-minute live narrative, T-30 prep checklist, recovery cheats. Updated and aligned with the new seed.
6. **`docs/PHASE-1-2-WALKTHROUGH.md`** — feature-by-feature reference doc Colonel can keep. Two columns: feature → what it does. Suitable for printing.
7. **`docs/CLIENT-WHATSAPP-SUMMARY.md`** — short bullet summary Ashwin can paste into WhatsApp after the demo (Colonel prefers written summaries over voice).
8. **`docs/smoke-test-2026-05-09.md`** — manual smoke-test log capturing each demo route at 375px and 1280px, plus the full demo flow run-through.

End with `git add -A && git commit -m "feat(demo): phase 1+2 demo prep — seed, polish, docs"` (do **not** push — Ashwin pushes manually due to missing WSL git credentials).

---

## Phase A — Diagnostics & Health Check (read-only first)

Do not modify anything in this phase. Capture state.

```bash
# 1. Type-check + lint + test baseline
pnpm type-check
pnpm lint
pnpm --filter @smartshaadi/api test     # expect 310 passing
pnpm --filter @smartshaadi/web test     # capture count
pnpm --filter @smartshaadi/api build
pnpm --filter @smartshaadi/web build

# 2. Audit current seed
ls -la packages/db/seed/
cat packages/db/seed/index.ts
# Count: how many users, profiles, vendors, bookings, weddings, guests, products,
# orders, rental_items, rental_bookings, notifications? Record raw counts.

# 3. Boot dev environment to baseline
docker compose ps                       # postgres + mongo + redis up?
pnpm --filter @smartshaadi/api dev &     # API on :4001
pnpm --filter @smartshaadi/web dev &     # web on :3003
sleep 5
curl -sS http://localhost:4001/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003

# 4. List every demo-visible route and the data it depends on
# Output to docs/superpowers/plans/2026-05-09-phase1-2-demo-prep.md as Table 1.
```

Document everything in the plan file under **§A — Baseline**. Include: tests passing/failing, build status, seed row counts vs target, any route returning 500/404 with a default seed, any console errors at runtime.

---

## Phase B — Issue Triage

From baseline + `docs/phase2-qa-report.md`, fix what blocks a clean demo. Defer cosmetic items.

### Must fix before demo

1. **Recurring auth bug pattern (P0):** grep all repositories and route handlers for `userId` being passed where `profileId` is expected. The Better Auth `userId` → `profileId` resolution must happen at the boundary, not deep in queries. If found, fix at the service layer and add a regression test.
2. **Budget GET endpoint (⚠️ #3 from QA):** add `GET /api/v1/weddings/:id/budget` returning `{ total, allocations: { decor, catering, photography, venue, music, misc }, spent, remaining }` so the budget tab has a clean data source instead of bleeding from the wedding-detail payload. Add corresponding test in `apps/api/src/weddings/wedding.service.test.ts`.
3. **Empty state polish on demo-visible routes:** every list page must have a skeleton + empty illustration + warm CTA per `.claude/commands/ui-component.md` Step 6. Routes to verify: `/matches`, `/chat`, `/vendors`, `/weddings/[id]/guests`, `/weddings/[id]/tasks`, `/store`, `/store/orders`, `/rentals`, `/vendor-dashboard/*`, `/admin/*`. After this prompt's seed, none of these should be visibly empty — but the empty-state itself must still be production-grade for the moment a fresh user signs up.
4. **Indian locale formatting:** every currency display uses `₹` and Indian numbering (`1,50,000` not `150,000`). Every date uses `en-IN` locale. Every phone number renders as `+91 99999 90001`. Centralize in `apps/web/src/lib/format.ts` if not already.
5. **`USE_MOCK_SERVICES=true` banner:** persistent footer or top bar saying "Mock Mode — OTP: 123456 · Test card: 4111 1111 1111 1111 · Aadhaar: 1234-5678-9012". Hide when `NODE_ENV === 'production' && !USE_MOCK_SERVICES`. This kills any "wait, why didn't I get an SMS" confusion mid-demo.

### Defer (document, do not fix today)

- Daily.co real video — external blocked on `DAILY_CO_API_KEY`. Mock UI must show "Mock video room created — real Daily.co flips on with API key" badge.
- Real Razorpay webhook end-to-end — external blocked on company registration.
- DigiLocker / MSG91 — same.

For deferred items, add a one-line note in the demo flow doc explaining what flips on day-of activation. Colonel asked for honesty over polish.

---

## Phase C — Seed Data Build (the bulk of the work)

**Identity convention (do not deviate):**

| Persona | Name | Role | Phone | Notes |
|---|---|---|---|---|
| Bride | **Priya Khanna** | INDIVIDUAL | +91 99999 00001 | Punjabi Hindu, 27, Delhi, Software PM at Microsoft, IIT Delhi |
| Groom | **Arjun Malhotra** | INDIVIDUAL | +91 99999 00002 | Punjabi Hindu, 30, Delhi, Investment Banking VP, IIM Ahmedabad |
| Mother (bride side) | **Sunita Khanna** | FAMILY_MEMBER | +91 99999 00003 | Linked to Priya's profile |
| Vendor 1 | **Royal Decor** (Meera Iyer) | VENDOR · DECORATION | +91 99999 00010 | Delhi, ₹50k–2L packages |
| Vendor 2 | **Tandoor Tales** (Rohit Kapoor) | VENDOR · CATERING | +91 99999 00011 | Delhi, ₹800–1500 per plate |
| Vendor 3 | **Lens & Light Studios** (Vikram Singh) | VENDOR · PHOTOGRAPHY | +91 99999 00012 | Delhi, ₹1.5L–4L packages |
| Vendor 4 | **Acharya Rameshwar** | VENDOR · PRIEST | +91 99999 00013 | Delhi, ₹15k–35k per ceremony |
| Vendor 5 | **Asha Boutique** (Asha Gupta) | VENDOR · CLOTHING | +91 99999 00014 | Mumbai, sherwani/lehenga retail |
| Vendor 6 | **Diamond Dazzle** (Karan Shah) | VENDOR · JEWELLERY | +91 99999 00015 | Mumbai, bridal sets |
| Vendor 7 | **Beats Brigade** (DJ Aman) | VENDOR · MUSIC | +91 99999 00016 | Delhi, sangeet + reception |
| Coordinator | **Plan & Pamper** (Neha Reddy) | EVENT_COORDINATOR | +91 99999 00020 | Cross-vendor coordinator |
| Admin | **Admin User** | ADMIN | +91 99999 00099 | platform admin |
| Support | **Support Agent** | SUPPORT | +91 99999 00098 | KYC + dispute review |

All seed users have `verifiedAt = NOW()` and KYC status `VERIFIED`. Mock OTP `123456` works for all.

### C1 — Match feed seed for Priya (12 candidates beyond Arjun)

Generate 12 additional male profiles for Priya's match feed with **varied attributes** so the feed shows real diversity (not 12 clones). Mix:

- 4 Delhi-based, 3 Mumbai, 2 Bangalore, 1 Pune, 1 Hyderabad, 1 NRI (USA)
- Ages 26–34
- Communities: 5 Punjabi Hindu, 2 Marwari, 2 Tamil Brahmin, 1 Sindhi, 1 Bengali, 1 Sikh
- Education spread: IITs/NITs/BITS/IIMs/AIIMS/foreign universities
- Income: ₹15L–80L p.a.
- Heights 5'7"–6'2"
- Manglik distribution: 3 manglik, 9 non-manglik (so the manglik filter has signal)

For each, compute Guna Milan score against Priya's horoscope (Tula rashi, Chitra nakshatra, non-manglik) using the actual `apps/ai-service/routers/horoscope.py` if running, **or** pre-compute via the same scoring logic in TypeScript and store the result in `match_scores` table. Spread scores across 12–34 out of 36 — Arjun lands at **28/36** (sweet spot, demo-friendly), one candidate at **34/36** (highest), one at **13/36** (low — shows the slider in action).

Each match profile gets:
- Full bio (~150 words, India-context, written naturally — "I love trekking in the Himalayas, weekend pottery classes…")
- 3–5 hobbies (mix: cricket, classical music, travel, cooking, photography, hiking, reading, fitness, gaming, theatre, painting, tabla, chess, F1)
- Family details (occupation, siblings)
- Career details
- Lifestyle (food preference, drink, smoking)
- Partner preferences
- 2–3 photo placeholders — use **initials avatars** generated by the existing fallback system per `.claude/commands/ui-component.md` ("warm gradient fallback with initials"). Do not seed real face photos.

**Reciprocal match logic:** all 12 candidates have partner preferences that match Priya (so they show up in her reciprocal feed). 4 of them are **paused/inactive** to demonstrate the filter excluding non-engaged profiles.

### C2 — Priya & Arjun deep profile

Both with full content per `docs/DATABASE.md` MongoDB profile schema:

- **Priya:** Software PM, ₹35L p.a., Microsoft Delhi, IIT Delhi B.Tech CS 2019, vegetarian, non-smoker, occasional drinker, hobbies: trekking + reading + tabla + photography. Family: father retired Army Colonel (sets up Colonel Deepak rapport), mother homemaker, one younger brother in college. Horoscope: DOB 1998-08-14, TOB 04:32 IST, POB Delhi, rashi Tula (Libra), nakshatra Chitra, non-manglik, Guna 28/36 with Arjun. Partner pref: 28–32, 5'9"–6'2", Punjabi/Hindu, salary >₹25L, Delhi/Mumbai. **Safety Mode ON.** 4 photos. Profile completeness 92%.
- **Arjun:** Investment Banking VP at Goldman Sachs, ₹65L p.a., Delhi, IIM-A MBA 2020, undergrad SRCC Delhi, vegetarian, occasional drinker, hobbies: cricket + investment podcasts + travel + cooking. Family: father businessman, mother homemaker, elder sister married. Horoscope: DOB 1995-11-22, TOB 09:15 IST, POB Delhi, rashi Mesha (Aries), nakshatra Bharani, non-manglik. 5 photos. Profile completeness 96%.

### C3 — Match requests + status spread

- **Priya → Arjun:** ACCEPTED 7 days ago. Sets up the chat seed.
- **Two suitors → Priya:** PENDING (so the requests inbox has signal).
- **Priya → one high-Guna candidate:** SENT (waiting on response).
- **One suitor → Priya:** DECLINED 3 days ago.
- **One profile blocked by Priya** (so block flow is visible in admin if asked).

### C4 — Chat seed (MongoDB)

Three conversations:

1. **Priya × Arjun (active):** 18 messages spanning 5 days. Mix of English and Hindi (test the translation toggle). Topics progress naturally: ice-breaker → hobbies → families → first meet plan → video call scheduled. Last message 2 hours ago.
2. **Priya × Suitor #4 (lukewarm):** 4 messages, last message 2 days ago, conversation stalled.
3. **Priya × Blocked Suitor (archived):** 2 messages then `BLOCKED` flag set; appears in admin's blocked list, hidden from Priya's chat list.

Each message: `{ matchId, senderId, content, contentHi (if Hindi sample), readAt, sentAt }`.

### C5 — Vendors with portfolios + reviews

For each of 7 vendors:

- 3–5 services with `priceFrom`, `priceTo`, `priceUnit`
- Portfolio in MongoDB (`vendor_portfolios` collection): about, tagline, 4–8 portfolio items each with `title`, `description`, `eventType`, `eventDate`, `photoKeys` (use `https://picsum.photos/seed/{vendor-slug}-{n}/800/600` URLs — deterministic, free-licence, won't break)
- 3–5 reviews per vendor (mix 4★ and 5★, one 3★ realistic critique on Tandoor Tales for the dispute backstory) with reviewer name + relative date
- `verified: true` on Royal Decor, Tandoor Tales, Lens & Light, Diamond Dazzle. Others `false` so the verified badge has visual signal
- Average ratings naturally derived from review spread (don't hardcode rating)

Royal Decor must surface in Delhi/Decor/₹1L–2L filter (this is the demo's filter screenshot).

### C6 — Bookings (state spread for the booking lifecycle demo)

- **#DEMO-001** Priya × Tandoor Tales — ₹1.2L, Dec 5 2026, status `IN_PROGRESS`, payment captured ESCROW_HELD. **Pre-seeded for the dispute demo.** A 1-image evidence already uploaded.
- **#DEMO-002** Priya × Royal Decor — ₹1.5L, Dec 5 2026, status `CONFIRMED`, payment ESCROW_HELD.
- **#DEMO-003** Priya × Lens & Light — ₹2.5L, Dec 5 2026, status `CONFIRMED`, payment ESCROW_HELD.
- **#DEMO-004** Priya × Acharya Rameshwar — ₹25k, Dec 5 2026, status `CONFIRMED`, payment ESCROW_HELD.
- **#DEMO-005** Past booking from another (seeded) couple → Beats Brigade — ₹80k, status `COMPLETED`, payment RELEASED, 5★ review attached. Demonstrates a clean closed booking.
- **#DEMO-006** Past booking → Royal Decor → status `DISPUTED → RESOLVED_REFUND`, evidence + admin verdict in audit log. Demonstrates a closed dispute.

Every state-change event must produce an `audit_logs` row with chained-hash. The audit log will be opened during the dispute demo.

### C7 — Wedding "Priya × Arjun, December 2026"

- `couple_profile_id`: linked to Priya's profile
- `date`: 2026-12-05
- `venue`: The Imperial, New Delhi
- `budget_total`: 25,00,000
- `status`: PLANNING

**Budget allocations** (₹): Decor 3,00,000 · Catering 8,00,000 · Photography 2,50,000 · Venue 6,00,000 · Music 1,00,000 · Clothing 1,50,000 · Jewellery 2,00,000 · Misc 1,00,000.

**Spent so far:** Decor 1,50,000 (deposit) · Photography 2,50,000 (full) · Catering 1,20,000 (deposit) · Music 0 · Clothing 75,000 · Jewellery 0 · Misc 25,000. Remaining budget surfaces accurately.

**Ceremonies (`ceremonies` table):**
- ROKA — 2026-09-15, ₹50k, status DONE
- ENGAGEMENT — 2026-10-20, ₹3L, status DONE
- HALDI — 2026-12-03, ₹1.5L, status PLANNED
- MEHENDI — 2026-12-03 evening, ₹2L, status PLANNED
- SANGEET — 2026-12-04, ₹4L, status PLANNED
- WEDDING — 2026-12-05, ₹12L, status PLANNED
- RECEPTION — 2026-12-06, ₹6L, status PLANNED

**Tasks (`wedding_tasks`):** 30 tasks across phases. Examples — "Finalize photographer ✅", "Book caterer ✅", "Send save-the-dates ✅", "Order wedding invitations 🟡 IN_PROGRESS", "Confirm venue floor plan ⬜", "Buy bridal lehenga ✅", "Mehendi artist booking ⬜ DUE in 14 days (overdue badge demo)". Mix `priority: HIGH/MEDIUM/LOW`, `assignedTo` between Priya/Arjun/Sunita/Plan & Pamper coordinator. Status spread: 12 DONE, 6 IN_PROGRESS, 12 PENDING, 1 OVERDUE.

**Wedding-vendor links (`wedding_vendors`):** map the 4 confirmed bookings (Tandoor Tales, Royal Decor, Lens & Light, Acharya Rameshwar) to the wedding with their ceremony assignments.

### C8 — Guests + RSVP

50 guests in Priya's `guest_list`:
- 30 RSVP YES, 8 NO, 6 MAYBE, 6 PENDING
- Mix sides: BRIDE 26 / GROOM 22 / BOTH 2
- Meal preferences: VEG 28, NON_VEG 14, JAIN 6, EGGETARIAN 2
- Plus-ones: 12 guests have plusOnes 1, 2 have 2
- Room assignments: 18 guests assigned rooms (RM-101 through RM-118), rest unassigned
- Relationships realistic: parents, siblings, cousins, college friends, work colleagues, family friends

Generate 1 public RSVP token for an unconfirmed guest so Ashwin can demo the public RSVP page (`/rsvp/:token`) without a fake-token 404. Document the URL in the demo flow doc.

Send `invitations` rows for 40 of them (20 EMAIL, 15 WHATSAPP, 5 SMS) with `sentAt` in the past week, some with `openedAt`, fewer with `rsvpAt`.

### C9 — E-commerce store

15 products across vendors:

- **Asha Boutique:** Royal Sherwani (Maroon) ₹45,000 · Designer Sherwani (Ivory + gold) ₹68,000 · Bridal Lehenga (Crimson) ₹1,20,000 · Lehenga (Pastel Pink) ₹85,000 · Kurta Set ₹12,000.
- **Diamond Dazzle:** Bridal Necklace Set (Polki) ₹4,50,000 · Maang Tikka set ₹85,000 · Kundan Bangle Pair ₹1,20,000 · Earrings (Jhumka) ₹35,000 · Mangalsutra ₹65,000.
- **Royal Decor:** Mandap Floral Package ₹95,000 · Stage Backdrop (Premium) ₹1,50,000 · Centerpiece × 10 ₹25,000.
- **Beats Brigade:** Wedding Music Playlist Pack (digital) ₹2,500.
- **Lens & Light Studios:** Pre-wedding shoot ₹35,000.

Each product: 2–4 image keys (use picsum.photos seeded URLs), stock 5–50, status ACTIVE. Soft-deleted demo product on Asha Boutique to verify the soft-delete path.

**Orders:**
- O-2026-0001: Priya buys Royal Sherwani for Arjun → status DELIVERED, with 5★ review.
- O-2026-0002: Priya buys Bridal Necklace Set → status SHIPPED, tracking number `BLU234567IN`, ETA 2 days.
- O-2026-0003: Priya buys Mandap Floral Package → status PROCESSING.
- O-2026-0004: Sunita buys Mangalsutra → status PAID, awaiting vendor fulfillment.
- O-2026-0005: An older customer → Asha Boutique → status CANCELLED, refund processed (demonstrates the cancel + restock + refund path).

Each order: `unitPrice` snapshot at order time per the Week 9 hardening rule.

### C10 — Rentals

8 rental items (mandap, sound system, LED wall, generator, chairs ×100, gold-frame chairs ×50, throne for groom, bridal palki). Each ₹/day rate, deposit, vendor.

Rental bookings: 1 active (Priya × Mandap, 2026-12-05, CONFIRMED) and 1 historical (a different couple's chairs booking, COMPLETED). Verifies the overbook guard isn't tripped.

### C11 — Notifications

10 notifications for Priya (mix of types, 3 unread, 7 read):
- "Arjun accepted your match request 💍" — 7 days ago
- "New message from Arjun" — 2 hours ago, unread
- "Your booking with Royal Decor is confirmed" — 5 days ago
- "Lens & Light Studios payment received" — 4 days ago
- "Tandoor Tales booking is in progress" — 3 days ago
- "Reminder: Mehendi artist booking due in 14 days" — 1 day ago, unread
- "RSVP from Anika Khanna: YES + 1 plus one" — 6 hours ago, unread
- "Order O-2026-0002 has shipped" — 1 day ago
- "Acharya Rameshwar confirmed for Sangeet" — 2 days ago
- "Profile completeness reached 92% 🌟" — 10 days ago

5 notifications each for Arjun, Royal Decor (vendor), Admin (3 KYC items + 1 dispute + 1 booking), so every dashboard has signal.

### Seed orchestrator

`packages/db/seed/index.ts` runs all sub-seeds in dependency order (users → profiles → vendors → matches → chat → bookings → weddings → ceremonies → tasks → wedding-vendors → guests → invitations → products → orders → rental_items → rental_bookings → notifications → audit_logs). Idempotent (use `.onConflictDoNothing()` and `findOrCreate`). Single command: `pnpm db:seed`. Re-running rebuilds without duplicates.

Add a `pnpm db:reseed` script that drops + re-pushes + re-seeds for clean demo resets.

---

## Phase D — UI Polish Pass

After seed lands, walk every demo route in both 375px and 1280px viewports. Apply `.claude/commands/ui-component.md` Quality Check on each.

**Routes to verify (in demo order):**

1. `/` (landing) — hero copy mentions Smart Shaadi, Burgundy headlines, Teal CTA, no plain white bg.
2. `/(auth)/login` — phone OTP flow, mock-mode banner visible, OTP `123456` works.
3. `/(profile)/onboarding/*` — wizard renders, photos step shows R2 upload UI in mock mode.
4. `/dashboard` — Priya sees: profile completeness 92%, 4 active bookings, 1 unread message, upcoming wedding countdown, recent matches strip.
5. `/matches` — 12 cards visible, Guna scores rendered with the colour bands per ui-component.md (red <17, amber 18–24, teal 25–32, green 33–36), reciprocal-only filter active.
6. `/profile/[id]` (Arjun's) — full layout: hero, photo gallery, Guna breakdown (8 koots expanded), bio, family, career, lifestyle, partner pref, verified badge, contact unlocked (because match accepted).
7. `/chat` — three conversations, Priya × Arjun shows latest message + unread badge.
8. `/chat/[matchId]` (Arjun) — 18 messages render, translation toggle works, schedule-video CTA renders.
9. `/weddings/[id]` — overview tab: countdown to Dec 5, 7 ceremonies cards, budget donut, task progress bar.
10. `/weddings/[id]/tasks` — 30 tasks, kanban columns DONE / IN_PROGRESS / PENDING, overdue badge red.
11. `/weddings/[id]/budget` — pie chart of allocations, spent vs remaining, both pulling from new `GET /budget` endpoint.
12. `/weddings/[id]/guests` — 50 rows, filter by RSVP status, dietary pref tag, room badge.
13. `/weddings/[id]/ceremonies` — 7 ceremonies with date + venue + budget allocation.
14. `/weddings/[id]/muhurat` — 5 suggested dates, Vedic explanations, "currently selected: Dec 5" highlighted.
15. `/rsvp/{token}` — public page works with the seeded token, no auth required.
16. `/vendors` — filter UI, default lists 7 vendors, Delhi+Decor+₹1L–2L filter narrows to Royal Decor.
17. `/vendors/[id]` (Royal Decor) — portfolio gallery, 4 services, 4 reviews, availability calendar, BOOK NOW button.
18. `/bookings` — Priya sees 4 active + 2 historical bookings.
19. `/bookings/[id]/dispute` — DEMO-001 dispute UI works.
20. `/store` — 15 products, category filter, price filter.
21. `/store/orders` — 4 orders for Priya, each with correct status badge.
22. `/store/orders/[id]` — order detail with items, tracking, ETA.
23. `/rentals` — 8 items, filter by category.
24. `/rentals/bookings` — Priya's mandap booking visible.
25. `/notifications` — 10 notifications with unread badges.
26. `/vendor-dashboard` — Royal Decor sees 2 active bookings, recent inquiries, ratings.
27. `/vendor-dashboard/store` — Royal Decor's 3 products + 1 active order.
28. `/admin` — KYC queue (3 pending), dispute queue (1 active), user count (15+), vendor count (7).

For each route, fix any of:
- Layout broken at 375px (horizontal scroll, clipped content)
- Missing skeletons during data fetch
- Empty state without illustration/CTA (post-seed every list should have data, but the empty branch must still be polished for fresh users)
- Off-palette colour (any non-Burgundy/Gold/Teal hex outside semantic success/warning/error)
- Currency without ₹ or with US grouping
- Phone without `+91 XXXXX XXXXX` format
- Missing loading state when navigation lags
- Touch targets <44px
- Buttons not `min-h-[44px]`
- Dates not in `en-IN` locale

Document fixes in `docs/smoke-test-2026-05-09.md` as a table: Route · Viewport · Issue · Fix · Status.

---

## Phase E — Demo Documentation

### E1 — `docs/PHASE-1-2-DEMO-FLOW.md` (30-minute walkthrough, replaces stale parts of DEMO-SCRIPT.md)

Sections:
- **T-30 prep checklist** (boot apps, run seed, open 6 browser tabs, log in to each persona, mock-mode banner check)
- **Browser tab map** (6 tabs: incognito for fresh signup, Priya, Arjun, Vendor Royal Decor, Admin, Public RSVP page)
- **0–3 min · Onboarding** — fresh signup with mock OTP 123456, profile wizard, KYC mock approval. Talking points: "Phone OTP only. Photos go direct to R2. KYC mock flips to DigiLocker on registration."
- **3–8 min · Matchmaking + Guna Milan** — open Priya's match feed, point out reciprocal filter, click Arjun, expand 8-koot Guna breakdown (28/36), show contact-unlocked-after-accept. Talking points: "Reciprocal — privacy-first. Guna is deterministic Vedic math, 91 tests."
- **8–12 min · Chat + Translation + Video** — open Priya × Arjun, send a Hindi message, toggle translation, schedule video call, show Daily.co mock room URL. Talking points: "Real Daily.co flips on with API key — same UI, real video."
- **12–18 min · Wedding Planning** — overview, ceremonies, Muhurat picker, tasks kanban, budget donut, guests list with RSVP stats, public RSVP page. Talking points: "Multi-event from day one. Muhurat is the Vedic engine reused. Guests RSVP without an account."
- **18–23 min · Vendors + Booking + Escrow + Dispute** — filter vendors, open Royal Decor, show DEMO-002 in CONFIRMED state with ESCROW_HELD, then open DEMO-001 (Tandoor Tales), raise dispute as Priya, switch to Admin, resolve as refund, show audit log chained-hash. Talking points: "Escrow — vendor only paid after completion. Dispute — admin resolves. Audit — chained-hash, tamper-evident."
- **23–28 min · E-commerce + Rentals + Vendor View + Admin** — open store as Priya, browse, place an order, switch to Asha Boutique vendor view, mark order shipped, show rentals, switch to Admin, show platform metrics. Talking points: "E-commerce reuses Razorpay path. Vendor self-serve. Admin sees everything."
- **28–30 min · Wrap** — recap one-month delivery, hand over WhatsApp summary, schedule next sync.
- **Recovery cheats** — table of common stutters and fallbacks (OTP didn't arrive → use Tab 2 Priya · Video doesn't open → show URL · Muhurat slow → cached result).

### E2 — `docs/PHASE-1-2-WALKTHROUGH.md` (printable reference for Colonel)

Two-column table: **Feature** → **What it does** → **Phase** → **Status**. Cover all 28 demo routes plus the back-end pillars (Better Auth, Drizzle multi-tenant safety, Bull queues, Pino redaction, audit log chained-hash, R2 pre-signed uploads, Sentry/PostHog wiring). Append a one-page "What's mocked vs live" matrix matching Slide 7 of CLIENT-PRESENTATION.md.

### E3 — `docs/CLIENT-WHATSAPP-SUMMARY.md`

Concise message Ashwin can copy-paste to Colonel after the demo. Format:

```
🟢 Smart Shaadi — One Month Delivered

Phase 1 ✅ — Auth, KYC, Profiles, Guna Milan, Reciprocal Matching, Chat, Vendors, Bookings, Escrow
Phase 2 ✅ — Wedding Planner, Multi-Ceremony, Muhurat, Guests + RSVP, Video Calls, Rentals, E-commerce

15 features, 310+ tests passing, design system across 28 screens.

Mocks active until company registration:
• Razorpay (5 days post-signing)
• DigiLocker (4 weeks post-MoU)
• MSG91 (2 weeks post-DLT)
• Daily.co (1 day post-API-key)

Demo recording: <Loom URL placeholder>
Walkthrough doc: PHASE-1-2-WALKTHROUGH.md
Provider activation runbooks: docs/PROVIDER-ACTIVATION/

Phase 3 starts Monday — AI Intelligence Layer.
```

### E4 — Update existing docs

- `ROADMAP.md` — tick Phase 1 + Phase 2 boxes that the new seed enables and that are demonstrably working at end-of-Phase-D.
- `CLAUDE.md` — update Current Status block: Phase 2 → COMPLETE (demo-ready), Mocks USE_MOCK_SERVICES=true.
- `docs/DEMO-SCRIPT.md` — add a top banner pointing to `docs/PHASE-1-2-DEMO-FLOW.md` as the current walkthrough.

---

## Phase F — Final Verification

```bash
# 1. Tests + types + lint
pnpm type-check       # zero errors across 8 packages
pnpm lint             # zero errors
pnpm --filter @smartshaadi/api test    # >= 311 (310 existing + ≥1 budget GET test)
pnpm --filter @smartshaadi/web test    # capture pass count

# 2. Fresh boot from a clean DB
docker compose down -v && docker compose up -d
sleep 6
pnpm db:push
pnpm db:seed
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 8
curl -sS http://localhost:4001/health        # 200
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003   # 200

# 3. Manual smoke — log Priya in, walk every route in PHASE-1-2-DEMO-FLOW.md
#    Each route must return 200, render data, no console errors.
#    Document in docs/smoke-test-2026-05-09.md.

# 4. Full demo dry-run with stopwatch — should land under 30 minutes.

# 5. Build prod bundles to confirm nothing breaks for deploy
pnpm --filter @smartshaadi/api build
pnpm --filter @smartshaadi/web build

# 6. Commit (do NOT push — Ashwin pushes manually)
git add -A
git commit -m "feat(demo): phase 1+2 demo prep — seed, polish, docs

- Seed expansion: 15 users, 14 profiles, 7 vendors, 6 bookings,
  1 wedding (50 guests, 30 tasks, 7 ceremonies), 15 products,
  5 orders, 8 rentals, 25 notifications, 3 chats, 12-card match feed
- New: GET /api/v1/weddings/:id/budget endpoint + test
- UI polish across 28 demo routes (375px + 1280px)
- Mock mode banner with credentials
- Indian locale formatting centralized
- Docs: PHASE-1-2-DEMO-FLOW.md, PHASE-1-2-WALKTHROUGH.md,
  CLIENT-WHATSAPP-SUMMARY.md, smoke-test-2026-05-09.md
- ROADMAP + CLAUDE.md status updates"
```

Print a final summary block at the end of the run with:
- Tests passing (with delta vs baseline 310)
- Routes verified (target 28/28)
- Files changed count
- Commit SHA
- One-line "ready to demo" or "blockers: …"

---

## Constraints & DO NOTs

- **Do not deviate from the persona names** — Priya, Arjun, Royal Decor, Tandoor Tales are already in CLIENT-PRESENTATION.md. Renaming them creates doc drift mid-presentation.
- **Do not seed real human face photos.** Initials avatars only (existing fallback handles this).
- **Do not bypass the multi-tenant filter.** Every query must still filter by user/profile.
- **Do not introduce real external API calls** — `USE_MOCK_SERVICES=true` stays on for the demo.
- **Do not push to git** — Ashwin pushes manually due to missing WSL credentials. Commit locally only.
- **Do not use `tsx watch` long-running on `/mnt/d/`** — it dies on DrvFs. After Phase C seed, restart the API server manually before Phase D smoke.
- **Do not enter Plan Approval Mode** in Claude Code — causes idle deaths on WSL per past sessions.
- **Do not invent new features.** Phase 3 (AI service, Family Inclination Index, Divorce Probability, etc.) is explicitly out of scope. If the seed accidentally surfaces a Phase 3 stub UI, hide it behind a feature flag.
- **Do not skip the design Quality Check** on touched components. Quality Check failure on a demo screen is worse than skipping the polish entirely.
- **Resolve `userId` → `profileId` at the boundary.** Any new seed code that touches `profiles.id` columns must take a `profileId`, not a `userId`. This is the recurring bug; do not reintroduce it.

---

## Done criteria (acceptance)

- [ ] `pnpm type-check && pnpm lint && pnpm test` all green
- [ ] `pnpm db:reseed` rebuilds the demo state from scratch in under 60s
- [ ] All 28 demo routes return 200, render seeded data, no console errors at 375px and 1280px
- [ ] Mock-mode banner visible on every page, hidden when env flag flips
- [ ] Indian currency + date + phone formatting consistent across web
- [ ] Public RSVP token works
- [ ] Dispute on DEMO-001 is end-to-end demonstrable (raise → admin resolve → refund → audit log)
- [ ] Loom-able 30-minute demo flow is reproducible from `docs/PHASE-1-2-DEMO-FLOW.md`
- [ ] WhatsApp summary, walkthrough doc, smoke-test log all written
- [ ] One commit, one diff, one local-only `git log` entry
- [ ] Final summary block printed with route count, test count, commit SHA, ready/blockers status

---

**Plan first. Wait for approval.** Once approved, execute Phase A → F sequentially. After each phase, summarize what shipped and what (if anything) deferred to the next.
