# CLAUDE CODE PROMPT — FINAL Demo Polish for Colonel Deepak (Tomorrow)

> Single paste, six phases, hard timeboxes. Goal: a 15-20 minute demo tomorrow evening that lands the one-month milestone with confidence. Polish over scope. Visible over hidden.
>
> **Plan first. Wait for approval. Then execute Phase A → F sequentially. Summarise each phase as it lands.**

---

## Mission

Tomorrow evening Ashwin demos Phases 1 & 2 to Colonel Deepak. The strict flow is fixed at 7 parts in 15-20 minutes:
**Landing → Auth → Profile + Safety → Match flow → Chat → Vendor + Wedding → Close.**

Today's session was interrupted mid-execution. Some Phase B issue triage and possibly part of Phase C reduced seed already shipped — start with a state audit so we don't re-do work. Then finish what's missing, upgrade the landing page to world-class, polish the 11 demo routes, hide everything that isn't ready, and produce the runbook.

Out of scope tomorrow (do not touch, do not navigate to during demo): e-commerce store · rentals · public RSVP page · escrow dispute flow · video calls · admin dashboard polish · Phase 3 AI features · mobile RN.

---

## Read first (15 min — required before plan)

1. `docs/DEMO-SCRIPT.md` — keep Priya/Arjun/Royal Decor/Tandoor Tales identities locked. Do not rename.
2. `docs/phase2-qa-report.md` — confirms 11 ✅ / 4 ⚠️ / 0 ❌, 310 tests passing.
3. `docs/smoke-test-week9.md` — note existing test phone convention (`+919999999001`); use that pattern, not `+91 99999 00001`, when seeding.
4. `.claude/commands/ui-component.md` — design system rules. Quality Check at the bottom is mandatory for any touched component.
5. `/mnt/skills/public/frontend-design/SKILL.md` — required reading before Phase C landing upgrade.
6. `apps/web/src/app/page.tsx` (the existing landing) plus any imported marketing components — read what's already there before redesigning.
7. `packages/db/seed/` directory — list every file, count rows in each seed table, capture as baseline.
8. The git log of the last 24 hours: `git log --oneline --since="36 hours ago"` — see exactly what shipped from today's interrupted session.

---

## Output expectations

Plan file: `docs/superpowers/plans/2026-05-10-final-demo-polish.md`.

Final deliverables:
1. Backfilled seed (Priya, Arjun, 12 matches, 1 chat, 6 vendors, 1 wedding) — only what isn't already there.
2. Landing page upgrade at `apps/web/src/app/page.tsx` (in-place, do not rebuild).
3. Demo-mode flag (`NEXT_PUBLIC_DEMO_MODE=true`) hiding e-commerce / rentals / admin / escrow tabs.
4. Polish pass on 11 strict-flow routes at 375px and 1280px.
5. `docs/DEMO-RUNBOOK-FINAL.md` — single-page paste-ready runbook.
6. `docs/CLIENT-WHATSAPP-SUMMARY.md` — short post-demo message for Ashwin to send Colonel Deepak.
7. Single local commit. Do not push.

---

## Phase A — State audit (30 min, READ-ONLY)

Do not modify anything. Capture exact current state.

```bash
# 1. Git state — what shipped today
git log --oneline --since="36 hours ago"
git status

# 2. Build/test/types baseline
pnpm type-check 2>&1 | tee /tmp/typecheck-baseline.log
pnpm lint 2>&1 | tee /tmp/lint-baseline.log
pnpm --filter @smartshaadi/api test 2>&1 | tail -20
pnpm --filter @smartshaadi/web build 2>&1 | tail -30

# 3. Seed inventory — what data exists right now
docker compose ps
ls -la packages/db/seed/
cat packages/db/seed/index.ts 2>/dev/null | head -100

pnpm --filter @smartshaadi/db exec drizzle-kit studio &  # optional
# OR direct SQL counts:
psql postgresql://vivah:vivah@localhost:5432/smart_shaadi -c "
  SELECT 'users' AS t, COUNT(*) FROM \"user\" UNION ALL
  SELECT 'profiles', COUNT(*) FROM profiles UNION ALL
  SELECT 'vendors', COUNT(*) FROM vendors UNION ALL
  SELECT 'vendor_services', COUNT(*) FROM vendor_services UNION ALL
  SELECT 'match_requests', COUNT(*) FROM match_requests UNION ALL
  SELECT 'match_scores', COUNT(*) FROM match_scores UNION ALL
  SELECT 'bookings', COUNT(*) FROM bookings UNION ALL
  SELECT 'weddings', COUNT(*) FROM weddings UNION ALL
  SELECT 'wedding_tasks', COUNT(*) FROM wedding_tasks UNION ALL
  SELECT 'guest_list', COUNT(*) FROM guest_list UNION ALL
  SELECT 'ceremonies', COUNT(*) FROM ceremonies UNION ALL
  SELECT 'notifications', COUNT(*) FROM notifications;
"

# 4. Mongo content
mongosh "$MONGODB_URI" --quiet --eval "
  db.profile_contents.countDocuments();
  db.chats.countDocuments();
  db.vendor_portfolios.countDocuments();
"

# 5. Demo-mode flag — does it exist?
grep -r "NEXT_PUBLIC_DEMO_MODE" apps/web/src/ 2>/dev/null | head -10
grep "NEXT_PUBLIC_DEMO_MODE" apps/web/.env.local 2>/dev/null

# 6. Existing landing page — what's there
cat apps/web/src/app/page.tsx | head -100
ls apps/web/public/ | head -30
ls apps/web/src/components/marketing/ 2>/dev/null

# 7. Boot apps to confirm clean baseline
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 8
curl -sS http://localhost:4001/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003
```

Document findings in the plan file under **§A — Baseline**. Specifically state:
- Tests passing count vs 310 baseline
- Build green or red (with errors listed)
- For each table: count present + count needed (target counts in §B below)
- Demo-mode flag: exists / does not exist
- Landing page: structure, components used, what already looks good vs what needs upgrade
- Existing photography in `apps/web/public/` (if any) — list paths

This audit determines the **gap list** for §B-§E. If something is already done well, do not re-do it.

---

## Phase B — Backfill seed (60 min)

**Identity convention (locked — must match what already exists if there's a seed convention):**

| Persona | Role | Phone (mock OTP `123456`) |
|---|---|---|
| Priya Khanna (bride) | INDIVIDUAL | `+919999900001` |
| Arjun Malhotra (groom) | INDIVIDUAL | `+919999900002` |
| Sunita Khanna (Priya's mother) | FAMILY_MEMBER | `+919999900003` |
| Royal Decor (Meera Iyer) | VENDOR · DECORATION | `+919999900010` |
| Tandoor Tales (Rohit Kapoor) | VENDOR · CATERING | `+919999900011` |
| Lens & Light Studios (Vikram Singh) | VENDOR · PHOTOGRAPHY | `+919999900012` |
| Acharya Rameshwar | VENDOR · PRIEST | `+919999900013` |
| Asha Boutique (Asha Gupta) | VENDOR · CLOTHING | `+919999900014` |
| Beats Brigade (DJ Aman) | VENDOR · MUSIC | `+919999900015` |
| Admin User | ADMIN | `+919999900099` |

If the existing seed (from §A audit) uses different phone numbers for Priya/Arjun, **keep the existing convention** — only backfill missing personas.

### Target row counts (post-Phase-B)

- `user` ≥ 14 (10 personas + 12 match candidates would be 22+; if AppNav shows count anywhere, OK)
- `profiles` ≥ 14 + 12 candidates = 26
- `match_scores` ≥ 12 (Priya × all 12 candidates), with Arjun at 28/36
- `match_requests` ≥ 4 (1 ACCEPTED Priya↔Arjun, 2 PENDING incoming for Priya, 1 SENT outgoing)
- `vendors` = 6, `vendor_services` ≥ 18 (3 per vendor)
- `weddings` = 1, `ceremonies` = 7, `wedding_tasks` ≥ 30, `guest_list` ≥ 50
- `notifications` ≥ 8 for Priya
- Mongo `profile_contents` ≥ 26 (Priya + Arjun + 12 candidates + 6 vendor reps + others)
- Mongo `chats` = 1 (Priya × Arjun, 12 messages)
- Mongo `vendor_portfolios` = 6

### Priya deep profile

27, Delhi, Punjabi Hindu, Software PM at Microsoft, ₹35L p.a., IIT Delhi B.Tech CS 2019, **father retired Army Colonel** (subtle Colonel Deepak rapport — keep this), mother homemaker, one younger brother in college. Vegetarian, non-smoker, occasional drinker. Hobbies: trekking, reading, tabla, photography. Horoscope: DOB 1998-08-14, TOB 04:32 IST, POB Delhi, rashi Tula, nakshatra Chitra, non-manglik. Partner pref: 28-32, 5'9"-6'2", Punjabi Hindu, ₹>25L, Delhi/Mumbai. **Safety Mode ON.** 4 photos (initials avatar fallback OR placeholder URLs from `apps/web/public/avatars/` if available). Profile completeness 92%.

### Arjun deep profile

30, Delhi, Punjabi Hindu, Investment Banking VP at Goldman Sachs, ₹65L p.a., IIM-A MBA 2020, undergrad SRCC Delhi. Father businessman, mother homemaker, elder sister married. Vegetarian, occasional drinker. Hobbies: cricket, investment podcasts, travel, cooking. Horoscope: DOB 1995-11-22, TOB 09:15 IST, POB Delhi, rashi Mesha, nakshatra Bharani, non-manglik. 5 photos. Profile completeness 96%. **Guna with Priya: 28/36** (sweet spot — hardcoded if AI service not running).

### 12 match candidates for Priya's feed (varied attributes)

- Cities: 4 Delhi, 3 Mumbai, 2 Bangalore, 1 Pune, 1 Hyderabad, 1 NRI USA
- Ages 26-34
- Communities: 5 Punjabi Hindu, 2 Marwari, 2 Tamil Brahmin, 1 Sindhi, 1 Bengali, 1 Sikh
- Education spread across IIT/NIT/BITS/IIM/AIIMS/foreign
- Income ₹15L-80L
- 3 manglik, 9 non-manglik
- Guna scores spread 12-34/36 — Arjun at 28, top candidate at 34, low at 13 (visible colour bands)
- Each: ~100-word bio, 3-5 hobbies, family details, career, lifestyle, partner prefs (all reciprocal-compatible with Priya so they pass the bilateral filter), 2-3 photo placeholders. **Initials avatars only — no real face photos.**
- 4 of 12 paused/inactive for engaged-only filter demo

### Match requests

- Priya → Arjun: ACCEPTED 7 days ago. Sets up the chat seed.
- Two suitors → Priya: PENDING (inbox has signal).
- Priya → one high-Guna candidate: SENT.
- One suitor → Priya: DECLINED 3 days ago.

### Chat (MongoDB) — Priya × Arjun

12 messages over 5 days, mostly English, **one Hindi line** for the translation toggle demo:
- Day 1: ice-breaker exchange (English)
- Day 2: hobbies + family questions (one Hindi line: "मेरी मम्मी कहती हैं कि आप बहुत अच्छे लगते हैं")
- Day 3: career talk
- Day 4: planning a meet
- Day 5: video call scheduled, last message "Looking forward to tomorrow!" 2 hours ago, unread by Arjun

Each message: `{ matchId, senderId, content, contentHi (where applicable), readAt, sentAt, type: 'TEXT' }`.

### 6 vendors with portfolios

For each: 3 services with `priceFrom`/`priceTo`/`priceUnit`. Mongo portfolio with `about`, `tagline`, 4 portfolio items, 3 reviews each. Royal Decor + Tandoor Tales + Lens & Light + Acharya verified; Asha + Beats unverified (badge contrast).

Portfolio image strategy: use `https://picsum.photos/seed/{vendor-slug}-{n}/800/600` URLs (deterministic, free-licence, won't break). When Phase C landing upgrade picks Unsplash hero photos, this can stay picsum — Unsplash is reserved for the hero where lift is highest.

Service prices:
- **Royal Decor:** Mandap Floral ₹95k-1.5L · Stage Backdrop ₹1.2L-2L · Centerpieces ₹15k-35k
- **Tandoor Tales:** Veg Plate ₹800-1500 · Live Counter ₹50k flat · Premium Multi-cuisine ₹1500-2500/plate
- **Lens & Light:** Wedding Day ₹1.5L-2.5L · Pre-wedding shoot ₹35k-80k · Cinematic film ₹2L-4L
- **Acharya Rameshwar:** Engagement ₹15k · Wedding ₹35k · Sangeet/Mehendi blessing ₹10k
- **Asha Boutique:** Sherwani ₹25k-80k · Bridal Lehenga ₹50k-1.5L · Reception Gown ₹40k-1L
- **Beats Brigade:** Sangeet DJ ₹50k · Wedding sound ₹80k · Reception package ₹1.2L

### Wedding "Priya × Arjun, December 2026"

- Date: 2026-12-05
- Venue: The Imperial, New Delhi
- Budget total: ₹25,00,000
- Allocations: Decor ₹3L · Catering ₹8L · Photography ₹2.5L · Venue ₹6L · Music ₹1L · Clothing ₹1.5L · Jewellery ₹2L · Misc ₹1L
- **Spent so far:** Decor ₹1.5L · Photography ₹2.5L · Catering ₹1.2L · Clothing ₹75k · Misc ₹25k (remaining derived)

**Ceremonies (7):** Roka 2026-09-15 DONE · Engagement 2026-10-20 DONE · Haldi 2026-12-03 PLANNED · Mehendi 2026-12-03 evening PLANNED · Sangeet 2026-12-04 PLANNED · Wedding 2026-12-05 PLANNED · Reception 2026-12-06 PLANNED.

**30 wedding_tasks** spread: 12 DONE / 6 IN_PROGRESS / 11 PENDING / 1 OVERDUE. Mix priorities and assignees (Priya / Arjun / Sunita / Plan & Pamper coordinator).

**50 guests:** 30 YES / 8 NO / 6 MAYBE / 6 PENDING. Mix VEG/NON_VEG/JAIN. 12 plus-ones. 18 with rooms assigned (RM-101 onwards). Realistic relationship spread.

### 8 notifications for Priya

3 unread, 5 read: match accepted by Arjun · new message from Arjun (unread) · booking confirmed Royal Decor · booking confirmed Lens & Light · task due in 14 days (unread) · profile completeness milestone · Acharya confirmed · order shipped (unread).

### Seed orchestrator

`packages/db/seed/index.ts` runs all sub-seeds idempotently (`.onConflictDoNothing()` + `findOrCreate` patterns). Single command: `pnpm db:seed`. Re-run rebuilds without duplicates. Add `pnpm db:reseed` that drops + repushes + reseeds for a clean demo reset (handy for Phase F dry-run).

**Bug pattern guard:** every seed function that touches `profiles.id`-keyed columns takes `profileId`, not `userId`. Resolve `userId → profileId` at the boundary. Recurring bug; do not reintroduce.

Verify after seed:
```bash
pnpm db:reseed
psql postgresql://vivah:vivah@localhost:5432/smart_shaadi -c "
  SELECT id, full_name, profile_completeness FROM profiles
  WHERE full_name LIKE '%Priya%' OR full_name LIKE '%Arjun%';
"
# Expect Priya 92, Arjun 96
```

---

## Phase C — Landing page world-class upgrade (2-3 hours, the headline visible win)

**Required reading first:** `/mnt/skills/public/frontend-design/SKILL.md`. The skill says: pick a bold direction, commit fully, avoid generic AI aesthetics, use distinctive choices.

**Aesthetic direction (locked):** luxury / refined Indian matrimonial — auspicious, editorial, premium-bridal-magazine. NOT corporate SaaS, NOT dating app, NOT generic Tailwind hero. The 30-second test from `ui-component.md`: a 55-year-old Indian parent should feel "this is for our family." A 28-year-old urban Indian should feel "this is finally tasteful."

**Design system stays locked:** Burgundy `#7B2D42` (headings) · Gold `#C5A47E` (accents, decoration, borders) · Teal `#0E7C7B` (CTAs only) · Ivory `#FEFAF6` (bg) · Playfair Display (headings) · Inter (body) · Noto Serif Devanagari (Devanagari accents).

**The landing already exists** — open it first, understand what's there, upgrade in place. Do not rebuild from scratch. Keep the logged-in dashboard redirect intact.

### Section-by-section upgrade

#### 1. HERO (the centerpiece — spend most of the time here)

Replace the existing hero with an **asymmetric two-column layout** on desktop (60/40 split), stacked on mobile.

**LEFT (60%):**
- Eyebrow line above headline: small horizontal rule + uppercase tracking-wide gold text "EST. 2026 · INDIA"
- Headline in Playfair Burgundy, two lines:
  - Line 1: "Where families find"
  - Line 2: *"their forever."* — italic with gold underline accent decoration
  - (or write something equally evocative — DO NOT use "Find Your Soulmate" / "Begin Your Journey" / generic AI matrimonial cliches)
- Subheadline Inter ~18px muted charcoal, max ~220 characters. Suggestion: "Smart Shaadi brings together verified matchmaking, family-led decisions, and end-to-end wedding planning — built for Indian families, not dating culture."
- Primary CTA: Teal "Start your journey" → `/login`, min-h-[48px] rounded-lg font-semibold
- Secondary text link: Burgundy "Watch the 2-min walkthrough" — anchor to "How it works" section
- Trust strip below CTAs: thin horizontal row, gold dot separators between 4 badges in muted gold uppercase tracking-wider 12px: "Verified Profiles · Safety Mode · Vedic Compatibility · Family-Led"

**RIGHT (40%): asymmetric photo collage**

Three overlapping images in an editorial arrangement:
- Primary large image (portrait orientation): an Indian bride in lehenga, or a couple at mandap. Rounded-2xl, 2px gold border, soft shadow.
- Secondary image offset top-right (smaller, square): close-up — mehendi hands, gold jewelry, or rangoli detail.
- Tertiary image offset bottom-left (smaller, landscape): couple laughing candidly, or hands holding.

Each image rotated slightly (1-3 degrees) for editorial collage feel. Gold corner ornament SVG decorations on the primary image (small, top-left and bottom-right corners — not borders).

**Photography source order (choose first that works):**
1. If `apps/web/public/marketing/` or similar has existing curated wedding images, use those.
2. Else use Unsplash with format `https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1200&q=80`. Search Unsplash for: "indian wedding", "mehendi", "indian bride", "mandap", "indian couple". Pick 3 photos that match warm/auspicious tone. Specify exact photo URLs in the JSX with `next/image` — width/height/sizes/alt.
3. If Unsplash IDs feel unstable, leave clearly-marked TODO comments with the search query and use solid gold-tinted placeholder blocks. Ashwin will hot-swap real CDN URLs before demo.

Use `next/image` always. Hero images: `priority` on primary, lazy on the rest. `quality={85}`. Proper `sizes` prop.

**DECORATIVE BACKGROUND:**
- Faint gold mandala SVG (opacity 0.05-0.08), large, partially off-canvas top-right and bottom-left of the hero section.
- Subtle texture grain overlay (data URL noise SVG) at opacity 0.03 across the section.
- NO solid flat colour blocks behind the hero — atmosphere matters.

**DEVANAGARI ACCENT:**
Render the word **विवाह** (vivaah) in Noto Serif Devanagari, large, gold, opacity 0.15, positioned behind/beside the headline as a decorative element. Atmospheric, not loud. Tasteful.

**MOTION:** on first paint, staggered reveal (CSS-only, prefers-reduced-motion respected, total under 1 second):
- Eyebrow line fades up (delay 0ms)
- Headline lines fade up sequentially (100ms, 250ms)
- Subheadline (400ms)
- CTAs (550ms)
- Photo collage scales in from 0.96 with fade (700ms)

#### 2. THREE PILLARS (refine existing if there)

Three cards in a row (stack mobile). Each: ivory bg, 1px gold border, rounded-xl, p-7, soft shadow.
- Replace any generic Lucide icon with a small custom hand-drawn-feel SVG mark — stylised diya/lamp, stylised couple silhouette, stylised mandap. 32px Burgundy stroke.
- Playfair heading Burgundy, Inter body muted.

Cards:
- **Verified Matchmaking** — "Reciprocal compatibility, Vedic Guna Milan across 8 Ashtakoot factors, and Safety Mode that hides contact details until both families are comfortable."
- **End-to-End Planning** — "Multi-ceremony wedding planner — Roka, Sangeet, Mehendi, Wedding, Reception — with budget tracking, Muhurat suggestions, and 50+ guest list."
- **Trusted Vendors** — "Verified photographers, decorators, caterers, priests, and stylists with portfolios, reviews, and a booking system that protects both sides."

#### 3. NEW SECTION — "Every ceremony, planned with care"

Showcase multi-ceremony breadth. Horizontal scrolling row on mobile, 4-column grid on desktop. Each card: small square photo (mehendi, sangeet, haldi, mandap, reception — different image per card), Playfair ceremony name in Burgundy, one Inter line. 5-7 ceremonies. Slightly darker ivory band background `#F8F5F0` to break vertical rhythm.

#### 4. NEW SECTION — "Vendors families trust"

2x3 grid (1-col mobile) using the seeded vendors from Phase B. Each card: vendor portrait (picsum URL from seed, TODO comment to swap real), Playfair vendor name Burgundy, category tag gold, ★ rating teal, "Starting from ₹X" muted. Cards rounded-xl with gold border. CTA below: "Browse all verified vendors" → `/vendors`.

#### 5. NEW SECTION — Social proof / testimonials

Three short testimonials from "couples" — feel real, India-context, signed first-name + city + year. Example: *"We met through Smart Shaadi in March; both our families were comfortable from day one. Married December."* — Aanya & Rohit, Pune · 2025. Cream cards with small gold corner ornament SVGs (not borders), Playfair italic for the quote, Inter for attribution. Show 3 simultaneously on desktop, stack mobile. NOT a slider.

#### 6. HOW IT WORKS

4-step horizontal stepper with thin gold connecting line between steps. Burgundy circle number badges, Playfair step heading, Inter one-liner:
1. Sign in with phone — secure OTP, no passwords
2. Build your profile — verified by KYC, lifestyle, horoscope, family
3. Discover matches — reciprocal-only feed, Guna scores, contact stays private
4. Plan together — chat, schedule meets, book trusted vendors, manage every ceremony

Each step gets a tiny supporting icon mark.

#### 7. CLOSING CTA BAND

Full-width band, deep-burgundy bg `#5C2032`. Playfair heading in ivory ("A wedding worth waiting for. A platform worth trusting."). Inter subheading muted ivory. Teal CTA "Begin your journey" → `/login`. Faint gold mandala decoration behind, very low opacity.

#### 8. FOOTER

Polish existing footer if present. Logo (Burgundy text-logo, Playfair), © 2026 Smart Shaadi, links About / Privacy / Contact (placeholder anchors fine), small social icons placeholder, +91 contact placeholder.

### Constraints

- Server components throughout (no `use client`) unless interaction needed for staggered motion
- Mobile-first 375px, NO horizontal scroll, all touch targets 44px+
- Theme tokens only (`bg-primary`, `text-teal`, `border-gold`) — NO hardcoded hex outside `globals.css` `@theme` block
- `next/image` for every photograph with explicit width/height/sizes/alt
- `pnpm --filter @smartshaadi/web build` finishes zero errors
- **TIMEBOX 3 HOURS.** If running long: ship hero + 3 pillars + closing CTA polished, defer ceremonies/vendors/testimonials sections. The hero alone sells the upgrade.

---

## Phase D — Polish pass on the 11 strict-flow routes (90 min)

For each route, walk at 375px and 1280px, apply `ui-component.md` Quality Check, fix issues. Document in `docs/smoke-test-2026-05-10.md` as a table: Route · Viewport · Issue · Fix · Status.

### The 11 routes

1. `/` (landing) — covered in Phase C.
2. `/login` (or `/(auth)/login`) — phone OTP form, mock-mode banner, OTP `123456` works.
3. `/dashboard` — Priya sees: 92% completeness, active bookings count, unread messages, wedding countdown, recent matches strip.
4. `/profile/me` — all tabs render: Personal, Family, Career, Lifestyle, Horoscope. Photos with gold border. Partner prefs visible. Safety Mode toggle ON.
5. `/matches` — 12 cards visible, Guna scores with colour bands (red <17 / amber 18-24 / teal 25-32 / green 33-36), reciprocal-only filter active, requests inbox tab with 2 PENDING.
6. `/profile/[arjun-id]` (or `/matches/[arjun-id]`) — full Arjun profile, expanded 8-koot Guna breakdown showing 28/36, "Match Accepted" badge, contact unlocked.
7. `/chat` — three conversations visible (Priya × Arjun primary, others quieter), unread badge on Arjun.
8. `/chat/[matchId]` (Arjun) — 12 messages render, Hindi line shows correctly, translation toggle has the "preview" tooltip, schedule video call CTA renders.
9. `/vendors` — 6 vendors visible, filter by Delhi + Decoration narrows to Royal Decor, verified badges differentiated.
10. `/vendors/[royal-decor-id]` — portfolio gallery (4 picsum images), 3 services, 3 reviews, availability calendar, BOOK NOW CTA in Teal.
11. `/weddings/[id]` — overview tab: countdown to Dec 5, 7 ceremony cards, budget donut, task progress bar. Tabs visible (excluding Escrow + Payments which are demo-mode-hidden): Overview · Tasks · Budget · Guests · Ceremonies · Muhurat · Vendors.

### What to fix on each route

- Layout broken at 375px (horizontal scroll, clipped content)
- Missing skeleton during data fetch
- Empty state without illustration / CTA (post-seed every list should have data; the empty branch must still be polished)
- Off-palette colour (any non-Burgundy/Gold/Teal hex outside semantic success/warning/error)
- Currency without ₹ or with US grouping (must be `1,50,000` not `150,000`)
- Phone without `+91 99999 00001` format
- Missing loading state when navigation lags
- Touch targets <44px
- Buttons not `min-h-[44px]`
- Dates not in `en-IN` locale
- Devanagari font missing where it should render

Centralise formatters in `apps/web/src/lib/format.ts` (`formatCurrency`, `formatDate`, `formatPhone`) if not already.

---

## Phase E — Demo mode hide + runbook + WhatsApp summary (60 min)

### E.1 — Demo-mode flag

Check Phase A audit. If `NEXT_PUBLIC_DEMO_MODE` already exists from today's interrupted session, verify behaviour. Else add:

```bash
# apps/web/.env.local
NEXT_PUBLIC_DEMO_MODE=true
```

In sidebar / bottom-nav component:
```tsx
const DEMO_HIDDEN_ROUTES = ['/store', '/store/orders', '/rentals', '/rentals/bookings', '/admin', '/vendor-dashboard']
const visibleNavItems = ALL_NAV_ITEMS.filter(item =>
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' || !DEMO_HIDDEN_ROUTES.includes(item.href)
)
```

Keep visible: Dashboard · Matches · Chat · Vendors · My Wedding · Profile.

In `weddings/[id]` layout, hide Escrow + Payments tabs when `DEMO_MODE=true`. Keep: Overview · Tasks · Budget · Guests · Ceremonies · Muhurat · Vendors.

### E.2 — Demo Mode pill

Subtle floating pill bottom-right (12px text, gold border, ivory bg, rounded-full, p-3, fixed positioning, z-50), only renders when `NEXT_PUBLIC_DEMO_MODE=true`:

> Demo Mode · OTP 123456 · Test card 4111-1111-1111-1111

Never visible in real production (env flag).

### E.3 — Translation toggle copy

In chat translation toggle component, change tooltip to: "Hindi-English translation — preview (full integration in next phase)". Don't demo translation heavily. One Hindi message in seed is enough.

### E.4 — `docs/DEMO-RUNBOOK-FINAL.md`

Single page, paste-ready:

```markdown
# Smart Shaadi · 15-20 Min Demo Runbook · FINAL

## T-15 prep
1. `pnpm db:reseed` — clean demo state (60s)
2. `pnpm --filter @smartshaadi/api dev &` (port 4001)
3. `pnpm --filter @smartshaadi/web dev &` (port 3003)
4. Curl /health both — green
5. Open 4 browser tabs:
   - **T1:** `localhost:3003` (logged out — landing demo + fresh signup)
   - **T2:** `localhost:3003/dashboard` logged in as Priya (`+919999900001` OTP `123456`)
   - **T3:** `localhost:3003/dashboard` logged in as Arjun (`+919999900002` OTP `123456`)
   - **T4:** `localhost:3003/vendor-dashboard` logged in as Royal Decor (`+919999900010` OTP `123456`)
6. Confirm Demo Mode pill is visible bottom-right
7. Hide all other browser tabs and notifications. Phone on silent. DnD on.

## Minute 0–2 · Vision + Landing (T1)
- Open T1, let the hero photography land. Pause 3 seconds.
- Read headline aloud: "Where families find their forever."
- Scroll slowly through pillars → ceremonies → vendor preview → testimonials
- Click "Start your journey" → land on /login
- **Say:** "The goal is a complete marriage-centric ecosystem — matchmaking, planning, vendors, AI workflows in phases."
- **Don't:** deep-dive features.

## Minute 2–4 · Auth + Roles (T1 → T2)
- /login: enter `+919999900001` (Priya)
- OTP `123456` → submitted
- Land on dashboard
- Mention: "Individual, Family Member, Vendor — same auth flow."
- **Don't:** deep-dive roles.

## Minute 4–7 · Profile + Safety Mode (T2)
- Open Profile → walk tabs: Personal · Family · Career · Lifestyle · Horoscope
- Show photos with gold border, partner preferences
- Show Safety Mode toggle ON
- Open Arjun's profile from match feed → point to phone + email **hidden** badge
- **Say:** "Contact details remain protected until both sides are comfortable."

## Minute 7–11 · Match flow (T2 → T3)
- /matches → 12 cards, varied Guna, reciprocal-only filter on
- Click Arjun → 28/36 Guna, expand 8-koot breakdown
- Show "Match Accepted 7 days ago"
- Open requests inbox → 2 PENDING, briefly accept one
- **Say:** "Reciprocal — both sides must pass each other's filters before surfacing. Privacy-first by design."

## Minute 11–14 · Chat (T2 + T3)
- Click chat with Arjun → 12 messages visible
- Type a new message in T2 → switch T3 → message arrives real-time
- Point to one Hindi message in conversation
- Hover translation toggle → tooltip shows "preview"
- **Say:** "AI-assisted conversation and compatibility features are integrating phase by phase."
- **Don't:** oversell AI.

## Minute 14–18 · Vendor + Wedding (T2 + T4)
- /vendors → filter Delhi + Decoration → Royal Decor card
- Click Royal Decor → portfolio gallery, 3 services, 3 reviews, verified badge
- Switch T4 → vendor dashboard with active bookings
- Switch back T2 → My Wedding → Priya × Arjun, Dec 5 2026
- Show: countdown · 7 ceremonies · budget donut · 30-task kanban · 50 guests
- **Don't navigate to:** Escrow/Payments tabs · Store · Rentals · Admin (all hidden)

## Minute 18–20 · Close strong
- **Say:** "Right now the focus is stabilising the core flows and frontend experience phase by phase. The architecture is structured to support the full roadmap — AI Intelligence Layer, Vendor Utilization Engine, Mobile, NRI."
- Hand WhatsApp summary
- Schedule next sync

## Recovery cheats
| Stutter | Fix |
|---|---|
| OTP doesn't arrive | Use T2 (already logged in as Priya) |
| Match feed slow | Refresh; Redis cache populates after first hit |
| Chat won't send | Refresh tab; Socket.io reconnects |
| Page errors | Say "Let me note that for after the demo" — move on |
| Photos broken on landing | Don't dwell; scroll past hero faster |

## Tab cheat
- T1 = Landing/login (start, ~2 min)
- T2 = Priya (~12 min — main thread)
- T3 = Arjun (~3 min — chat real-time + match accept)
- T4 = Royal Decor vendor (~30 sec at minute 15)

## Don't
- Don't apologise for rough edges. State them, move on.
- Don't let the Colonel click. You drive.
- Don't go off-script into hidden routes.
- Don't oversell AI — Phase 3.
```

### E.5 — `docs/CLIENT-WHATSAPP-SUMMARY.md`

Concise message for Ashwin to paste to Colonel Deepak post-demo:

```
🟢 Smart Shaadi — One Month Delivered

Phase 1 ✅ — Auth, KYC, Profiles, Guna Milan, Reciprocal Matching, Chat, Vendors, Bookings
Phase 2 ✅ — Wedding Planner, Multi-Ceremony, Muhurat, Guests + RSVP, Rentals, E-commerce, Video Calls

15+ features · 310+ tests passing · Design system across 28 screens · 7 vendors · full Priya × Arjun reference flow

Mocks active until company registration:
• Razorpay (5 days post-signing)
• DigiLocker (4 weeks post-MoU)
• MSG91 (2 weeks post-DLT)
• Daily.co (1 day post-API-key)

Phase 3 starts Monday — AI Intelligence Layer.
```

---

## Phase F — Final verification + commit (45 min)

```bash
# 1. Tests + types + lint + build
pnpm type-check
pnpm lint
pnpm --filter @smartshaadi/api test    # ≥310
pnpm --filter @smartshaadi/web build   # zero errors

# 2. Fresh demo state
docker compose down -v && docker compose up -d
sleep 6
pnpm db:push
pnpm db:reseed

# 3. Boot apps
pnpm --filter @smartshaadi/api dev &
pnpm --filter @smartshaadi/web dev &
sleep 8
curl -sS http://localhost:4001/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3003

# 4. Hit each of the 11 strict-flow routes — record HTTP status
for path in "/" "/login" "/dashboard" "/profile/me" "/matches" "/chat" "/vendors" "/weddings"; do
  echo -n "$path: "
  curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3003$path"
done

# 5. Stopwatch dry-run with the runbook — must land 15-20 min
# Document any stutters in docs/smoke-test-2026-05-10.md

# 6. Commit (DO NOT push)
git add -A
git commit -m "feat(demo): final polish for client demo

- Backfilled seed: 14 users, 26 profiles (Priya + Arjun + 12 candidates),
  6 vendors with portfolios, 1 wedding (50 guests, 30 tasks, 7 ceremonies),
  12-message chat with Hindi line, 8 notifications, 4 match requests
- Landing page world-class upgrade: photography hero, asymmetric layout,
  Devanagari accent, gold mandala, motion, 8 sections
- Polish pass: 11 strict-flow routes at 375px and 1280px
- Demo mode flag hides e-commerce/rentals/admin/escrow tabs
- Demo Mode pill bottom-right with mock credentials
- Indian formatting centralized
- Docs: DEMO-RUNBOOK-FINAL.md, CLIENT-WHATSAPP-SUMMARY.md, smoke-test log"
```

Print final summary block:
- Tests passing (delta vs 310)
- Routes verified (target: 11/11)
- Files changed count
- Commit SHA
- Stopwatch demo dry-run time
- "Ready to demo" or "Blockers: …"

---

## Constraints (do NOT violate)

- **Do not push to git** — Ashwin pushes manually due to missing WSL credentials.
- **Do not enter Plan Approval Mode** in Claude Code — causes idle deaths on WSL.
- **Do not deviate from Priya / Arjun / Royal Decor / Tandoor Tales** identities — already in DEMO-SCRIPT.md.
- **Do not seed real human face photos** — initials avatars or placeholder URLs only.
- **Do not introduce real external API calls** — `USE_MOCK_SERVICES=true` stays on.
- **Do not build out of scope** — no e-commerce / rentals / RSVP / escrow / video / admin polish.
- **Do not push the AI story** — translation is a stub, AI suggestions are Phase 3.
- **Do not skip the design Quality Check** on touched components in Phase D.
- **Resolve `userId → profileId` at every boundary** — recurring bug.
- **Do not exceed Phase C's 3-hour timebox** — ship hero + pillars + closing CTA polished, defer the rest if running long.

---

## Done criteria

- [ ] `pnpm type-check && pnpm lint && pnpm test` all green (≥310)
- [ ] `pnpm db:reseed` rebuilds full demo state in <90s, idempotent
- [ ] All 11 strict-flow routes return 200, render seeded data, no console errors at 375px and 1280px
- [ ] Landing page: hero photography renders, mandala visible, Devanagari accent renders, motion plays, 8 sections cohesive
- [ ] Demo Mode pill visible bottom-right, hidden when env flag flips
- [ ] Demo-hidden routes (store, rentals, admin) absent from nav when flag on
- [ ] Indian currency / date / phone formatting consistent across web
- [ ] DEMO-RUNBOOK-FINAL.md paste-ready, single page
- [ ] CLIENT-WHATSAPP-SUMMARY.md ready to send
- [ ] Stopwatch dry-run lands 15-20 min
- [ ] One commit, local only
- [ ] Final summary block printed: route count, test count, commit SHA, ready/blockers

---

**Plan first. Wait for approval. Then execute Phase A → F sequentially.** Summarise each phase as it lands. If any phase looks like it'll exceed its timebox by >20%, pause and flag — don't push through.
