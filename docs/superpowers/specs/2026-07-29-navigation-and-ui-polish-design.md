# Navigation & UI Polish — Design Spec

- **Date:** 2026-07-29
- **Status:** Approved by user (section-by-section) — pending final spec review
- **Scope:** Web marketing navbar, logged-in web nav, React Native tab bar (Phase 1);
  full mobile-app screen polish in three waves (Phase 2)

## Problem

The user finds the navigation "bad on mobile and on the website." Concretely:

1. **Marketing navbar (logged out)** — five flat links, no dropdown menus on desktop;
   the mobile hamburger opens a sparse full-screen overlay (five giant links in
   whitespace, no icons/grouping, demo-mode chip overlaps the bottom CTA).
2. **Logged-in web nav** — structurally sound (TopNav + bottom bar + More sheet), but
   VENDOR pushes 7 primary items into both navs: 8 cramped ~45px columns in the phone
   bottom bar, overflow risk in TopNav at tablet widths.
3. **RN app tab bar** (`FloatingTabBar`) — good concept (floating burgundy pill), rough
   edges: hardcoded labels, no unread badge on Chat, abrupt hide on nested screens.
4. **Mobile app screens** — inconsistent use of the existing primitives (`Screen`,
   `Card`, `States`, `Skeleton`); missing loading/empty/error states on some screens;
   spacing/token drift.

Design direction (user choice): my judgment — premium wedding-brand feel, consistent
with the burgundy/gold/ivory design system. No reference product to copy.

## Non-goals

- No switch away from the floating-pill RN tab bar; no new tabs.
- No i18n plumbing in the RN app (doesn't exist there; separate project if wanted).
- No information-architecture changes to logged-in routes — only which items are
  primary vs in More, per breakpoint.
- No new marketing pages; dropdowns link only to existing destinations.

---

## Phase 1 — Navigation chrome (one PR-sized chunk)

### 1a. Marketing navbar, desktop (`apps/web/src/components/marketing/Navbar.client.tsx`)

Keep: floating pill container, scroll compression, 3-column grid, auth cluster.

Restructure links into:

| Item | Type | Contents |
|---|---|---|
| How it Works | plain link | `/#how-it-works` |
| Features ▾ | dropdown panel | icon + one-line description rows: Guna Milan Compatibility, AI Matchmaking, For Families, Safety & Privacy → home-page section anchors as full paths (`/#…`) so they work from any page |
| Browse ▾ | dropdown panel | Wedding Vendors `/vendors`, Help Centre `/help`, About Us `/about`; plus a "Popular searches" column with 4–6 programmatic SEO links (communities/cities) for internal linking |
| Pricing | plain link | `/#pricing` |

Built on Radix `NavigationMenu` via shadcn (new primitive at
`apps/web/src/components/ui/navigation-menu.tsx`) — keyboard nav, hover intent,
Escape-close, aria wiring come from the primitive. Panel styling: ivory surface,
gold hairline border, burgundy headings, `rounded-2xl`, `shadow-card`,
`motion-reduce` respected.

### 1b. Marketing navbar, mobile

Replace the full-screen overlay with a right-side slide-in drawer (~85% width,
max 360px) built on the existing shadcn `Sheet` (focus trap + scroll lock free):

- Header row: logo + close (44px targets).
- Body: same groups as desktop as labeled sections with icons — Features group,
  Browse group, How it Works / Pricing as plain rows.
- Footer pinned with safe-area padding: language toggle + Login + full-width
  Get Started Free CTA. Footer spacing accounts for the demo-mode chip so it no
  longer overlaps the CTA.
- Spring slide-in + backdrop blur, consistent with the logged-in More sheet.

### 1c. Logged-in web nav polish (`nav-config.ts`, `TopNav.client.tsx`, `AppNav.client.tsx`)

- Split per-role nav sets into `primaryMobile` (max 4 + More) and `primaryDesktop`.
  VENDOR mobile becomes: Home, Bookings, Orders, Profile, More; Products, Payouts,
  Links move to the More sheet. Other roles unchanged (already ≤4).
- TopNav: breakpoint cap so items never wrap/overflow at tablet widths (extras
  gated behind `lg:`; below that they live in More).
- Align More-dropdown panel paddings/typography with the new marketing dropdown
  panels so both feel like one system. Bottom-bar active pill treatment unchanged.

### 1d. RN tab bar refinement (`apps/mobile/src/components/FloatingTabBar.tsx`)

- **Unread badge on Chat**: small burgundy count/dot on the tab icon, driven by the
  existing conversations hook (`src/features/chat/useConversations.ts`).
- Keep hide-on-nested behavior; audit that every screen that hides the bar renders
  an `AppHeader` with a back button (no nav-stranding).
- Centralise tab label config; tune hairline border/shadow; keep haptics;
  extend `FloatingTabBar.test.tsx` for the badge and a11y state.

## Phase 2 — Mobile app screen polish (full sweep, three waves)

Shared checklist applied to every screen:

1. All data states designed: loading skeleton, empty, error-with-retry (use
   `States`/`Skeleton` primitives).
2. Spacing on a 4px rhythm; design-system tokens only (no hardcoded hex).
3. Safe-area correctness; ≥44px touch targets.
4. `AppHeader` present and consistent on every screen.

| Wave | Screens | Notes |
|---|---|---|
| **2a — Tab tracks** | Matches (feed, detail, requests, shortlists) · Chat (list, thread) · Vendors (browse, detail) · Profile (view, edit) · More | card rhythm, photo fallbacks, unread styling, keyboard behavior in thread, CTA hierarchy, More mirrors web More sheet grouping |
| **2b — First-run flow** | phone entry, OTP verify, 8 onboarding steps | polished as one continuous journey (first impression) |
| **2c — Utility screens** | settings, billing, payments, bookings, booking/[vendorId], notifications, notification-preferences, blocked-users, help, biometric-unlock | full checklist treatment |

Each wave is its own PR-sized change with its own regression run.

## Verification

- **Web (Phase 1):** full Verification Protocol — `turbo type-check --force`, build,
  browser QA at 375px and 1440px through the real login flow (PG/Redis restart needs
  the operator's sudo on this box), console clean, no 500s.
- **Mobile:** no emulator/toolchain on this box — verification is jest
  (215 green baseline, extended for badge + screen states), type-check, code review.
  Final visual sign-off is the operator's via Expo Go against a short checklist.
- Each phase/wave ends with the regression set vs the frozen baseline
  (api 1413/1417 with 4 known pre-existing RAG-merge failures · ai 462 · web 33 ·
  mobile 215 · type-check 13/13).

## Rollout order

Phase 1 (all navigation chrome) → Phase 2a → 2b → 2c. Design doc committed first;
implementation follows a written plan (writing-plans skill) per phase.

## Key files

| Area | Files |
|---|---|
| Marketing nav | `apps/web/src/components/marketing/Navbar.client.tsx`, new `ui/navigation-menu.tsx`, existing `ui/sheet.tsx` |
| Logged-in nav | `apps/web/src/components/layout/nav-config.ts`, `TopNav.client.tsx`, `AppNav.client.tsx` |
| RN tab bar | `apps/mobile/src/components/FloatingTabBar.tsx`, `AppHeader.tsx`, `src/features/chat/useConversations.ts` |
| RN screens | `apps/mobile/src/app/**` (waves 2a–2c), primitives in `apps/mobile/src/components/` |
