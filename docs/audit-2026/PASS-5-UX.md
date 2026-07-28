# Smart Shaadi — Audit PASS 5: UX · Design · Accessibility

> **READ-ONLY audit. Nothing was fixed.** This document records findings only.
> Each carries a `file:line` (or route) source pointer **and** a screenshot
> filename, a severity, and a reproducible signal (deterministic browser probe
> or console error). Remediation is **deferred** to an explicitly-authorised fix
> pass — audit and fix stay separated. Companion files: `PASS-0-INVENTORY.md`
> (route/feature ground truth), `PASS-1-*` / `PASS-2` / `PASS-3` / `PASS-4`.

**Date:** 2026-07-27 · **Branch:** `main` · **Scope:** design-system fidelity,
touch targets, 375 px layout, loading/empty/error states, en-IN formatting,
accessibility, and role correctness — walked in a **running app with real QA
logins**, because UI defects compile clean and are invisible to static reading.

**Severity scale (UX-tuned)**
- **P0** — a core task is blocked on a primary surface, layout breaks so content
  is unusable, a role renders another role's data, or a page throws instead of
  showing an error state.
- **P1** — significant defect with a workaround: visibly broken/untranslated text
  on a real surface, a contrast failure on a primary label, a form unusable by a
  screen reader, a role's core workflow dead-ending.
- **P2** — correctness/robustness gap with limited blast radius: sub-44 px
  controls, secondary-text contrast, a page-level horizontal scroll that hides no
  CTA, a runtime hydration warning, unformatted data, a dev note leaked to UI.
- **P3 / info** — polish; recorded for completeness.

---

## 1. Headline

**No P0 confirmed.** The app is, viewport-for-viewport, in strong shape: the
ivory page background (`#FEFAF6`), burgundy Playfair headings, teal/gold accents,
Indian-grouped currency, en-IN dates, PII masking, 44 px primary CTAs, and
polished empty states hold up **consistently across all six roles and both
viewports**. The defects that exist are concentrated and specific rather than
systemic rot.

The four P1s are: (1) **member names render white-on-light** on photo-less match
cards — on the *primary discovery surface*; (2) the **vendor Orders page shows raw
i18n key paths** as its filter-tab labels; (3) the **core profile/onboarding form
has 7 controls with no programmatic label** (screen-reader-invisible); and (4) an
**EVENT_COORDINATOR cannot open the wedding their own dashboard links to** — every
sub-page 404s for them while rendering for the owner.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 4 |
| P2 | 11 |
| P3 / info | 3 |

**Two report-wide caveats.** (a) A browser form-filler **extension** injected a red
"N Issues" badge and triggered React "browser extension messes with HTML"
hydration warnings on some pages — these are **tooling noise, discounted**, and are
distinct from the app's own in-page DEMO banner and from the genuine
`Date.now()`-class hydration mismatch in U9. (b) The seed labels `qa-ind-01` /
`qa-ind-02` as "ind" but they carry **role = ADMIN** in the `user` table; the real
INDIVIDUAL accounts start at `qa-ind-03`. This is a QA-fixture naming quirk, **not
a product finding** — the app routed `qa-ind-01` to `/admin` correctly.

---

## 2. Methodology & environment

**Stack (local, all reachable — not the WSL-unreachable Railway proxy):** Postgres
`:5433`, Mongo `:27017` (Windows-side, via WSL localhost forwarding), Redis
`:6379`; API `:4000`, AI `:8000`, web `:3007` (port 3000 was held by an unrelated
app). `USE_MOCK_SERVICES=true`, mock OTP `123456`. `WEB_URL`/`NEXT_PUBLIC_APP_URL`
pinned to `:3007` so CORS + Better-Auth trusted origins matched
(`apps/api/src/lib/cors.ts`).

**Login.** Real UI login was exercised once for the smoke gate (qa-ind-01 →
6-box OTP auto-submit → `/admin`). Role-switching thereafter used the documented
phone-OTP endpoints (`/api/auth/phone-number/send-otp` + `verify` code `123456`)
to re-establish the session cookie per role — faster, and every landing was
re-confirmed via `/api/auth/get-session`.

**Per-page method.** For each page at each viewport: `navigate` → inject a global
**animation-freeze** style → run a **deterministic `browser_evaluate` probe** that
returns structured JSON (page background, `scrollWidth − innerWidth` overflow,
sub-44 px interactive controls with sizes, `<img>` missing `alt`, form controls
lacking any programmatic name, WCAG contrast ratios of text vs. its effective
background, raw-i18n-key leak scan, `<table>` inner overflow, `<title>`/`<h1>`) →
JPEG screenshot to the gitignored `.playwright-mcp/` → screenshots read for every
unique template and every probe-flagged page. Console errors were captured per
navigation and filtered against extension/hydration noise.

**Roles & accounts walked (ground truth from the `user` table, 44 `qa-%` rows):**

| Role | Account | Name |
|---|---|---|
| INDIVIDUAL | `qa-ind-03` `+917000000003` | Sneha Kulkarni |
| VENDOR | `qa-ven-01` `+917000000201` | Royal Garden Banquets |
| ADMIN | `qa-admin-01` `+917000000401` | QA Admin One |
| SUPPORT | `qa-support-01` `+917000000501` | QA Support One |
| FAMILY_MEMBER | `qa-fam-01` `+917000000101` | Lakshmi Deshmukh |
| EVENT_COORDINATOR | `qa-coord-01` `+917000000301` | Anil Coordinator |

**Coverage — representative-comprehensive (every unique template + all 6 role
shells + one instance per dynamic detail template + auth/onboarding/legal/
marketing + deliberately-triggered empty/error/404 states).** Templates walked
(~40 unique, each at 375 px primary; 1440 px probed on shared shell + all
table-heavy admin/vendor surfaces):

- **Auth/public:** `/login`, `/verify-otp`, `/register`, `/` (marketing, logged
  out), `/privacy`, `/profile`→404.
- **INDIVIDUAL:** `/dashboard`, `/feed`, `/matches`, `/vendors`, `/vendors/[id]`,
  `/payments`, `/settings`, `/settings/billing`, `/assistant`, `/chats`,
  `/notifications`, `/store`, `/requests`, `/weddings`, `/profile/personal`.
- **VENDOR:** `/vendor-dashboard` (+ `/orders`, `/store`), `/vendor/payouts`,
  `/vendor/leads`, `/vendor/insights`, `/vendor/pricing`, `/vendor/onboarding`
  (→ redirect).
- **ADMIN:** `/admin`, `/admin/users`, `/admin/revenue`, `/admin/kyc`,
  `/admin/reconciliation`.
- **SUPPORT:** `/support`. **FAMILY:** `/family`. **COORDINATOR:** `/coordinator`
  + wedding template family `/weddings/[id]/{budget,guests,day-of}`.

Duplicate-template routes (e.g. `/likes` `/shortlist` `/viewers`, admin
`*/[id]` detail pages, wedding sub-tabs) surface the same shell and were not
re-screenshotted; where a systemic component defect was found (match card, page
title, touch targets) it is logged **once** as systemic rather than per-page.

---

## 3. The mandated matrix — `Route | Viewport | Issue | Severity`

| Route | Viewport | Issue | Sev |
|---|---|---|---|
| `/feed`, `/dashboard` | 375 + 1440 | Match-card member **name is white text**; washes out on photo-less placeholder cards (light gradient) | **P1** (U1) |
| `/vendor-dashboard/orders` | 375 + 1440 | Filter tabs render **raw i18n keys** `vendorRole.orders.tabALL/PENDING/SHIPPED/DELIVERED` | **P1** (U2) |
| `/profile/personal` (onboarding) | 375 + 1440 | **7 form controls with no programmatic label** (dob + 6 selects) | **P1** (U3) |
| `/weddings/[id]/*` (coordinator) | 375 + 1440 | Assigned coordinator gets **404 on every wedding page** their dashboard links to | **P1** (U4) |
| `/dashboard`, `/feed` | 375 + 1440 | "96% match" badge white-on-green **3.77:1** (<4.5) | P2 (U5) |
| `/dashboard` | 375 + 1440 | Profile-completeness pill labels green-on-white **3.77:1** | P2 (U5) |
| `/dashboard`, `/profile/personal`, global nav | 375 + 1440 | Sub-44 px touch targets: profile sub-nav 25.6 px, calendar cells 41 px, top-nav 36 px, user-menu 32 px, form selects 42 px | P2 (U6) |
| `/` (marketing) | 375 | **Page horizontal scroll** — 32 px overflow (doc 407 px) from uncontained testimonials carousel | P2 (U7) |
| `/admin` | 1440 | **Dev TODO + source filename leaked to UI**: "…see TODO in AdminHealthAndRisk.client.tsx" | P2 (U8) |
| `/vendors/[id]` | 375 + 1440 | **Hydration mismatch** console error (availability calendar, `Date.now`/timezone class) | P2 (U9) |
| `/admin` | 1440 | KYC mini-table columns **cramped/truncated** in the narrow dashboard card | P2 (U10) |
| `/vendors/[id]` | 375 + 1440 | Vendor phone **unformatted** `+918777010088` (not `+91 87770 10088`) | P2 (U11) |
| `/profile`, any 404 | 375 + 1440 | 404 page heading is **not an `<h1>`** (no top-level landmark) | P2 (U12) |
| `/vendors`, `/payments`, `/settings`, `/family`, … | 375 + 1440 | **Generic `<title>`** "Smart Shaadi — India's…" on many app pages; **doubled** "… \| Smart Shaadi \| Smart Shaadi" suffix on others | P2 (U13) |
| `/vendor/payouts` (as INDIVIDUAL) | 375 + 1440 | `/vendor/*` **not in the redirect matcher** — renders empty vendor shell to non-vendors (no data leak) | P2 (U14) |
| `/profile/personal` | 375 + 1440 | Step rail shows **5 dots** but progress reads **"Step 1 of 8"** | P2 (U15) |
| `/vendor-dashboard` | 375 + 1440 | "**₹0.0k**" abbreviation shown for zero revenue | P3 (U16) |
| `/weddings/[id]` (bare root) | 375 + 1440 | Bare wedding root **404s** (no index redirect) | P3 (U17) |
| `/login`, `/register` | 375 + 1440 | `<h1>` is the "Smart Shaadi" wordmark; the page action is an `<h2>` | P3 (U18) |

---

## 4. Findings summary

| ID | Sev | Title | Area | Route(s) | Status |
|---|---|---|---|---|---|
| U1 | **P1** | White member-name text unreadable on photo-less match cards | design/a11y | `/feed`, `/dashboard` | OPEN |
| U2 | **P1** | Vendor Orders filter tabs render raw i18n key paths | i18n | `/vendor-dashboard/orders` | OPEN |
| U3 | **P1** | Profile/onboarding form — 7 controls lack a programmatic label | a11y | `/profile/personal` | OPEN |
| U4 | **P1** | Coordinator 404s on the wedding their dashboard links to | role/UX | `/weddings/[id]/*` | OPEN |
| U5 | P2 | Contrast 3.77:1 on match badge + completeness pills | a11y | `/dashboard`, `/feed` | OPEN |
| U6 | P2 | Multiple sub-44 px touch targets | a11y | global + `/dashboard`, `/profile/personal` | OPEN |
| U7 | P2 | 375 px page horizontal scroll from testimonials carousel | layout | `/` | OPEN |
| U8 | P2 | Internal TODO + source filename shown in admin UI | polish | `/admin` | OPEN |
| U9 | P2 | Hydration mismatch on vendor availability calendar | runtime | `/vendors/[id]` | OPEN |
| U10 | P2 | KYC mini-table columns cramped in dashboard card | layout | `/admin` | OPEN |
| U11 | P2 | Vendor phone shown unformatted | format | `/vendors/[id]` | OPEN |
| U12 | P2 | 404 heading is not an `<h1>` | a11y | any 404 | OPEN |
| U13 | P2 | Generic + doubled `<title>` across app pages | SEO/polish | many | OPEN |
| U14 | P2 | `/vendor/*` not role-gated (empty shell to non-vendors) | role | `/vendor/payouts` | OPEN |
| U15 | P2 | Step-rail count (5) ≠ progress copy ("of 8") | copy | `/profile/personal` | OPEN |
| U16 | P3 | "₹0.0k" for zero revenue | format | `/vendor-dashboard` | OPEN |
| U17 | P3 | Bare wedding root 404s (no index redirect) | routing | `/weddings/[id]` | OPEN |
| U18 | P3 | Auth-page `<h1>` is the wordmark, action is `<h2>` | a11y | `/login`, `/register` | OPEN |

---

## 5. Per-finding detail (P1)

### U1 — Member name is white text; unreadable on photo-less match cards
**Severity:** P1 · **Area:** design/a11y · **Route(s):** `/feed`, `/dashboard`
("Today's Matches") · **Status:** OPEN.

**What.** Match cards overlay the member's **name in white** at the bottom of the
photo. On cards backed by a real (dark) photo this is fine. On **photo-less
cards** — which render an initial-letter avatar on a *light* teal/gold→cream
gradient (the seeded profiles without an uploaded photo) — the white name sits on
a light background and is very hard to read.

**Evidence.** `p5-ind-feed-375.jpeg` — "Nikhil Bajaj", "Aarav Mehrotra", "Vivek
Agarwal" wash out; "Rohan Joshi" / "Aditya Deshmukh" (real photos) are legible.
Same component on `/dashboard` ("Aarav Mehrotra", `p5-ind-dashboard-375.jpeg`).
The contrast probe flagged the name node as `rgb(255,255,255)` on an effective
`rgb(255,255,255)` (ratio 1.0) — a text-over-image false positive for the *photo*
cards, but the exact real defect for the *placeholder* cards. Source component:
`apps/web/src/components/match/MatchFeed.client.tsx` (feed card) + the dashboard
"Today's Matches" card.

**Failure mode (why P1).** `/feed` is the **primary discovery surface** and the
name is the single most important label on the card. Any member without a photo —
a large share at launch — is effectively anonymous in the feed.

**Blast radius.** Every match card app-wide that can render without a photo:
`/feed`, `/dashboard`, and likely `/matches`, `/likes`, `/shortlist`, `/viewers`
(same card component family).

**Proposed remediation — DEFERRED.** Add a darker gradient scrim behind the name
band, or switch the placeholder-avatar variant's overlay text to a dark token
(`text-foreground`) — the photo variant can keep white-on-scrim.

### U2 — Vendor Orders filter tabs render raw i18n key paths
**Severity:** P1 · **Area:** i18n · **Route:** `/vendor-dashboard/orders` ·
**Status:** OPEN.

**What.** The order-status filter tabs display the literal strings
**`vendorRole.orders.tabALL`** and **`vendorRole.orders.tabPENDING`** (plus
`tabSHIPPED`, `tabDELIVERED`) instead of "All / Pending / Shipped / Delivered".

**Evidence.** `p5-ven-orders-i18nkeys-375.jpeg` (the teal filter button literally
reads `vendorRole.orders.tabALL`). Four console errors on load:
`MISSING_MESSAGE: Could not resolve 'vendorRole.orders.tab{ALL,PENDING,SHIPPED,
DELIVERED}' in messages for locale 'en'` —
`.playwright-mcp/console-2026-07-26T21-18-10-201Z.log:7,19,31,43`. Root cause:
`apps/web/src/app/[locale]/(app)/vendor-dashboard/orders/page.tsx:109` builds the
label as `t(\`tab${value}\`)` under the `vendorRole.orders` namespace, but those
`tab*` keys are absent from `apps/web/messages/en.json`; next-intl falls back to
the key path. **Sweep:** isolated among the pages walked — `/vendor/leads`,
`/vendor/insights`, `/vendor-dashboard/store`, `/vendor/pricing` are clean — **but
the sibling `vendor-dashboard/rentals/page.tsx:105` uses the identical
`t(\`tab${value}\`)` pattern and should be checked for the same missing keys**
(not runtime-verified this pass).

**Failure mode (why P1).** Visibly broken, untranslated text on a real
vendor-facing surface. Reads as a half-finished build.

**Blast radius.** Every vendor viewing their Orders queue; probably Rentals too.

**Proposed remediation — DEFERRED.** Add `vendorRole.orders.tab{ALL,PENDING,
SHIPPED,DELIVERED}` (and the rentals equivalents) to `messages/en.json` (+ `hi.json`).

### U3 — Profile/onboarding form: 7 controls have no programmatic label
**Severity:** P1 · **Area:** accessibility · **Route:** `/profile/personal` (the
onboarding step-1 form) · **Status:** OPEN.

**What.** Every field has a **visible** text label ("Date of Birth", "Marital
Status", "Religion", "Mother Tongue", "State", "Height"), but **7 of 12 controls
are not programmatically associated** with it — no `<label for>`, `aria-label`,
`aria-labelledby`, or `title`. Screen readers announce them as bare comboboxes /
an unlabeled date field.

**Evidence.** `p5-ind-profile-personal-375.jpeg` (visible labels present). Probe:
the 7 unlabeled controls are `dob` (date input) and the selects `maritalStatus`,
`heightFt`, `heightIn`, `religion`, `motherTongue`, `currentState`; the text
inputs (Full Name, About Me) were fine. Source: the personal-details form under
`apps/web/src/app/[locale]/(app)/profile/personal/`.

**Failure mode (why P1).** The profile form is the **core onboarding gate** — a
screen-reader user cannot reliably tell which combobox is Religion vs. Mother
Tongue vs. State. The step rail (Personal → Family → Career → Lifestyle →
Horoscope) means the same label pattern very likely repeats across all steps →
systemic.

**Blast radius.** Every screen-reader / voice-control user completing onboarding;
degrades autofill and form-control heuristics for everyone.

**Proposed remediation — DEFERRED.** Associate each label via `htmlFor`/`id`, or
wrap the control in its `<label>`, or add `aria-label`. Verify the other four
onboarding steps carry the same fix.

### U4 — Coordinator 404s on the wedding their own dashboard links to
**Severity:** P1 (P0-class **if** coordinators are meant to access assigned
weddings — see caveat) · **Area:** role/UX · **Route(s):** `/coordinator` →
`/weddings/[id]/*` · **Status:** OPEN.

**What.** `/coordinator` (as `qa-coord-01`, an assigned EVENT_COORDINATOR) links
to `/weddings/0ada0009…/day-of`. Following that link — and `/weddings/[id]`,
`/day-of`, `/budget` — returns the **"Page not found" 404 screen** for the
coordinator. The **same pages render for the wedding owner** (`qa-ind-01` sees
`/budget` with the full sub-nav: timeline/guests/tasks/vendors/budget/seating/
moodboard/website…).

**Evidence.** Probe: as `qa-coord-01`, `/weddings/[id]`, `/day-of`, `/budget` all
`is404: true` (`textLen` 146, the not-found body). As `qa-ind-01` (owner),
`/budget` `is404: false`, `h1: "Budget"`, full sub-nav present.
`p5-wedding-budget-375.jpeg` (owner view). The link originates on `/coordinator`
(probe `weddingLink: "/weddings/0ada0009…/day-of"`).

**Failure mode (why P1).** The coordinator's entire job is managing assigned
weddings, and their landing page dead-ends at a 404. **Caveat on root cause:** this
is either (a) the coordinator isn't actually granted page-access to the wedding
they're "assigned" to (access enforced as 404 — reasonable security, but then the
dashboard should not surface an unusable link), or (b) a seed-assignment gap.
Distinguishing them needs a code check of the wedding-access guard vs. the
coordinator-assignment records — **if coordinators are intended to open assigned
weddings, this is P0** (core workflow fully blocked).

**Blast radius.** Every EVENT_COORDINATOR trying to open an assigned wedding.

**Proposed remediation — DEFERRED.** Confirm the intended access model; then
either grant coordinators read/manage access to assigned weddings, or stop
`/coordinator` from linking to a route the role cannot open (link to an
access-appropriate view instead).

---

## 6. Per-finding detail (P2)

### U5 — Contrast 3.77:1 on match-score badge + completeness pills
**P2 · a11y · `/dashboard`, `/feed`.** The "96% match" badge is white on
success-green `#059669` = **3.77:1** at 12 px; the profile-completeness pill
labels ("Personal", "Photos", …) are the same green on white = **3.77:1**. Both
below the 4.5:1 threshold for normal text. Evidence: probe on
`p5-ind-dashboard-375.jpeg`. **DEFERRED:** darken the green for small text, or
enlarge/bolden to reach the large-text 3:1 bar, or use `--color-gold-muted`-style
AA-safe tokens.

### U6 — Multiple sub-44 px touch targets
**P2 · a11y · global + `/dashboard`, `/profile/personal`, `/vendors/[id]`.** The
`Button` primitive enforces `min-h-[44px]` and primary CTAs comply, but several
recurring controls fall short: profile sub-nav tabs **25.6 px**, availability
calendar day cells **41 px**, top-nav links **36 px**, header user-menu button
**32×32**, form selects/date **42 px**, inline "See all"/"Open chat" links
**22 px**. Evidence: probe on `p5-ind-dashboard-375.jpeg`,
`p5-ind-profile-personal-375.jpeg`, `p5-ind-vendordetail-375.jpeg`. **DEFERRED:**
raise min touch height to 44 px (padding or `min-h`) on the sub-nav/tab/calendar
components.

### U7 — 375 px page horizontal scroll from testimonials carousel
**P2 · layout · `/` (marketing home).** At 375 px the document is **407 px wide
(32 px overflow)** → the whole landing page scrolls sideways. Culprit:
`apps/web/src/components/marketing/Testimonials.tsx:118` — the card is
`className="flex-shrink-0 w-[80vw] sm:w-[60vw] md:w-auto snap-start"`; the
`w-[80vw]` cards in the horizontal snap strip are not clipped to their section, so
their width leaks into page overflow. No CTA is hidden (hence P2, not P0).
Evidence: `p5-marketing-home-375.jpeg`; overflow probe listed the testimonial
card (`right: 940`, `w: 300`) as the widest offender. **DEFERRED:** wrap the strip
in `overflow-x-hidden`/`overflow-x-clip` (or `max-w-full` on the section), so the
carousel scrolls **inside** its own container instead of the page body.

### U8 — Internal TODO + source filename shown in admin UI
**P2 · polish · `/admin`.** The System-Health card renders user-facing helper text
**"AI service health — not reachable from web layer (see TODO in
AdminHealthAndRisk.client.tsx)"** — an engineering TODO plus a source filename,
shown to admins. Evidence: `p5-admin-home-1440.jpeg`;
`apps/web/src/app/[locale]/(app)/admin/AdminHealthAndRisk.client.tsx:127`.
**DEFERRED:** replace with a user-facing status string (e.g. "AI service metrics
unavailable") and keep the TODO in a code comment.

### U9 — Hydration mismatch on vendor availability calendar
**P2 · runtime · `/vendors/[id]`.** One console error on load:
`A tree hydrated but some attributes of the server rendered HTML didn't match the
client properties` — the `Date.now()`/timezone class (explicitly *not* the
extension variety). Almost certainly the **availability calendar** computing
"today" / disabling past dates on the client, differing from the SSR render.
Evidence: `.playwright-mcp/console-2026-07-26T21-03-52-128Z.log:7`;
`p5-ind-vendordetail-375.jpeg` (July-2026 calendar). Matches the known UTC/IST
hydration pattern in this repo. **DEFERRED:** compute the calendar's reference
date deterministically (server-provided "today", or gate the client-only bits
behind a mounted flag).

### U10 — KYC mini-table columns cramped in dashboard card
**P2 · layout · `/admin`.** The KYC-Review mini-table inside the narrow (~274 px)
dashboard card truncates its column headers to "PEND REVIE", "PEND APPE", "INFO
REQU", "DUPL FLAG", "SANC HITS" (an inner 720 px scroller squeezed into the card).
The **full `/admin/kyc` console renders fine** — this is only the constrained card
variant. Evidence: `p5-admin-home-1440.jpeg`; probe wideScroller `sw:720 cw:274`.
**DEFERRED:** show fewer columns (or icon+count chips) in the compact card, or let
it scroll without truncating labels.

### U11 — Vendor phone shown unformatted
**P2 · format · `/vendors/[id]`.** The vendor's business contact renders as
`+918777010088` rather than the app's own `+91 87770 10088` convention
(`apps/web/src/lib/format.ts` `formatPhoneIN`). This is **business** contact and is
intentionally public (not the masked-PII case in Architecture Rule 5), so it is a
formatting nit only. Evidence: probe on `p5-ind-vendordetail-375.jpeg`.
**DEFERRED:** run vendor contact through `formatPhoneIN`.

### U12 — 404 heading is not an `<h1>`
**P2 · a11y · any 404 (e.g. `/profile`).** The not-found page is otherwise
polished (ivory bg, "Page not found" + "Back to dashboard" CTA) but its heading is
**not an `<h1>`** (the probe found an empty `h1`), so assistive tech loses the
top-level landmark. Evidence: probe bodyText on `/profile`. **DEFERRED:** render
the not-found title as `<h1>` in the shared not-found component.

### U13 — Generic + doubled page titles
**P2 · SEO/polish · many routes.** Many app pages ship the generic `<title>`
**"Smart Shaadi — India's Smart Marriage Ecosystem"** (`/vendors`, `/payments`,
`/settings`, `/family`, `/vendor-dashboard`, `/profile/personal`, …) instead of a
page-specific title; others carry a **doubled brand suffix** "… | Smart Shaadi |
Smart Shaadi" (`/dashboard`, `/verify-otp`, `/vendors/[id]`). Evidence: page
`<title>` captured per navigation. **DEFERRED:** set per-route `metadata.title`
and de-duplicate the brand suffix in the title template.

### U14 — `/vendor/*` not role-gated (empty shell to non-vendors)
**P2 · role · `/vendor/payouts` (as INDIVIDUAL).** Direct-URL as `qa-ind-03`:
`/admin/*`, `/vendor-dashboard`, `/support`, `/coordinator` all correctly redirect
to `/dashboard`, but **`/vendor/payouts` does not** — it renders the "My Payouts"
shell (h1 + title) with **no data** (`money: []`, `hasPayoutData: false`). **No
financial data leaks** — the data layer filters by the caller's own vendor id — so
this is a defense-in-depth / consistency gap, not a breach: the `/vendor/*` family
isn't in the middleware redirect matcher the way `/vendor-dashboard/*` is.
Evidence: boundary probe + navigation. **DEFERRED:** add `/vendor` to the
role-redirect matcher in `apps/web/src/middleware.ts`.

### U15 — Step-rail count ≠ progress copy
**P2 · copy · `/profile/personal`.** The step rail shows **5** dots (Personal…
Horoscope) while the progress bar reads **"Step 1 of 8 · 13%"**. Evidence:
`p5-ind-profile-personal-375.jpeg`. **DEFERRED:** reconcile the two counters.

---

## 7. P3 / info

- **U16 — "₹0.0k" for zero revenue** (`/vendor-dashboard`): the k-abbreviation
  renders "₹0.0k" for a zero value; expected "₹0". `p5-ven-dashboard-375.jpeg`.
- **U17 — bare wedding root 404** (`/weddings/[id]`): the index has no page and
  404s even though the owner's sub-nav links to it; sub-pages like `/budget` work.
  Consider redirecting the root to the wedding dashboard tab.
- **U18 — auth-page `<h1>` is the wordmark** (`/login`, `/register`): the page
  action ("Welcome back" / "Create account") is an `<h2>`; the `<h1>` is the
  "Smart Shaadi" brand. Consistent but arguably the action should be the `<h1>`.

---

## 8. Positive confirmations

Balance: these checks **passed**, first-hand, across the walk.

- **Ivory page background `#FEFAF6`** on **every** page probed — never plain white.
- **Design tokens on-brand** throughout: burgundy `#7B2D42` Playfair headings,
  teal `#0E7C7B` primary CTAs, warm-gold accents, gold-muted secondary text.
- **Empty states are consistently polished** (icon + message + CTA): dashboard
  events & wedding, vendor reviews/orders/schedule, store ("No products found"),
  notifications, support queue, family hub (×3), wedding budget.
- **Loading states present** where exercised: OTP verify shows a "Verifying…"
  button state and auto-submits on the 6th digit.
- **Indian-grouped (lakh) currency everywhere:** vendors `₹11,74,000`, payouts
  `₹2,22,500`, revenue `₹1,60,200`, billing `₹1,199`, services `₹1,13,500`.
- **en-IN dates:** "Sunday, 26 July", "Matched on 20 Jul 2026", DOB "15-06-1999",
  admin "Refreshed 27 Jul, 2:52 am IST".
- **PII masking (Architecture Rule 5):** admin user-list emails masked
  (`ux***@…`), **no** plain phone numbers in the admin user table or KYC console;
  member phone masked on OTP screen ("+91 70xxxxxx01").
- **Responsive tables:** `/admin/users` collapses to cards at 375 px
  (`p5-admin-users-375.jpeg`); **no** table overflow at 375 or 1440 anywhere
  except the constrained admin-home KYC mini-card (U10).
- **44 px primary CTAs** (Book Now, Send Interest, Save & Continue, Connect,
  New Ticket) via the `Button` primitive's `min-h-[44px]`.
- **`alt` coverage:** the probe found **zero** visible `<img>` missing `alt` on any
  page walked.
- **"Skip to content"** link present in the app shell; global `*:focus-visible`
  ring defined in `globals.css`.
- **Role isolation:** `/admin/*`, `/vendor-dashboard`, `/support`, `/coordinator`
  redirect a wrong-role user to `/dashboard`; a coordinator cannot enumerate a
  non-assigned wedding (404, existence hidden); **all six role navbars show only
  their own links** (verified live against `components/layout/nav-config.ts`) with
  no cross-role leakage.
- **Register form** fields are fully labeled (0 unlabeled) — the U3 gap is
  specific to the profile/personal form, not universal.

---

## 9. Verification & baseline

- The smoke gate (real UI login → `/admin` for the ADMIN-seeded `qa-ind-01`) ran
  **before** the walk, proving app + auth worked; no finding is written from a
  non-running app.
- Every finding carries a **screenshot** filename (gitignored `.playwright-mcp/`)
  **and** a source pointer (`file:line` where located, else the route + probe).
- Automatable checks (overflow, touch size, `alt`, label association, contrast,
  raw-key leak, table overflow) come from the deterministic `browser_evaluate`
  probe and are **re-runnable**, not eyeballed.
- Console-error capture per page caught the runtime issues screenshots miss (U2,
  U9).
- **This pass adds a document only.** It changed no `apps/`/`packages/` source and
  moves none of the frozen test counts (API 1388 · ai-service 452 · web 24 ·
  mobile 208). The only runtime side effects were starting the dev servers and
  authenticating pre-existing `qa-%` accounts.
