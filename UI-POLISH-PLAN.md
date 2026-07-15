# Smart Shaadi — Complete UI/UX Audit & Polish Plan

> Working branch: `ui-polish/2026-07`. Progress: Phase 1 = `149a6ed`, Phase 2 = `1617a98`,
> **Phases 3–6 COMPLETE (2026-07-13, native-Windows parallel subagents):**
> Phase 3 = `73a0cd9…a26a8a7` (8 packages A–H + review-fix commit), Phase 4 = `5bd6736`,
> Phase 5 = `7656999`, Phase 6 = `1d7d5f5`, StaggerList consolidation = `8d113d6`.
> Phase 7 verified: web+api tsc clean, lint clean, 808/808 tests (fix `014c615`),
> prod build clean, smoke pass (sitemap has no /pricing; /create + /divorcee-widow 404;
> /hi/rentals pagination uses i18n Link). REMAINING for operator: e2e vs docker stack,
> manual browser pass 375/1280 across roles, Hindi native review of new keys.
> Pre-existing issues found (NOT from this branch): packages/db tsconfig.seed.json tsc
> OOMs (drizzle type explosion in seed files); multi-segment unknown paths (e.g. /foo/bar)
> 500 instead of 404 via (public)/[slug] — **FIXED in Phase 8** (`9a3beed` [locale]/[...rest]
> catch-all + i18n-free root not-found).
>
> **Phase 8 COMPLETE (2026-07-13/15, fresh audit round, 7 commits `9a3beed…8250b34`):**
> Phase 0 broken-tree fixes (AdminPayoutsClient ReferenceError, RequestsClient dead-import
> polish, legal-page icons, ProductCard tokens) = `344814e`; route error/loading boundaries
> for (legal)/(public)/(dev) + SectionDivider primitive = `e500504`; main sweep (209×
> text-2xs across 105 files, literal arrows→lucide in 17 files, 22 h1→PageHeader
> migrations, raw img→ImageWithFallback) = `0dcd00a`; delight layer (landing section
> rhythm + dividers, wedding-card gradient, ProfileCard pill reflow, global teal input
> focus ring) = `5a1d22f`; lint fix = `8250b34`. Zero new i18n keys (all existing reused).
> Review agent over batch diff: no defects. Verified: web tsc clean, next lint 0 errors,
> prod build clean, browser pass (landing w/ dividers + testimonials, login 375 teal ring,
> privacy icons, localized 404 for /foo/bar both locales, all public routes 200, no console
> errors). Dark mode intentionally deferred (tokens exist, unused). PageHeader skipped on 5
> back-link flex-row pages (store/orders, cart, checkout, bookings/new, support ticket).
> Operator tasks unchanged: e2e vs docker stack, authed-role browser pass, Hindi review.

## Context

Full UI/UX audit found the app split between 7 sprint-polished surfaces and ~145 pages that never got the polish pass. Systemic problems: duplicate primitives (2 PageHeaders, 2 EmptyStates, 2 skeleton treatments), card radius/border/shadow drift, 6+ H1 conventions, patchy i18n/motion, logo absent from the entire logged-in experience, nav active-state mismatch (teal mobile vs burgundy desktop), a11y gaps, 2 functional bugs (rentals locale-breaking pagination, /pricing SEO conflict), dead code, and orphaned pages. Goal: one consistent, premium, accessible experience across all 6 roles.

**User decisions (confirmed):** full sweep of all ~155 pages, phased · refine current logo mark (keep mandap+flame) · delete dead code + wire orphans · Phase-1 sequential then parallel subagents per area.

**Verified facts (Plan agent):** messages at `apps/web/messages/{en,hi}.json`; motion primitives = `components/motion/{PageTransition,StaggerList,AnimatedNumber}.client.tsx` + `components/shared/FadeUp.client.tsx`; `ui/EmptyState` is already prop-compatible with `shared/EmptyState` (pure import swap, 23 consumers); `shared/PageHeader` migration needs only `action`→`actions` rename in 2 files; `ui/skeleton.tsx` is the single base for all `shared/*Skeleton` composites (1-file warm-treatment fix cascades); `shared/DataTable.tsx` secretly imports `shared/EmptyState` (fix before deletion); `rounded-card` utility used in exactly 1 file (FamilyPanel) — literal-class sweep is the real fix.

## Branch

`ui-polish/2026-07` off current branch (or as user prefers). Baseline first: `pnpm type-check`, `pnpm --filter @smartshaadi/api type-check`, `pnpm --filter web build` must pass before edits.

---

## Phase 1 — Primitives & tokens (sequential) ✅ `149a6ed`

**1A Tokens** (~40 lines): `apps/web/src/app/globals.css` — `--radius-card: 12px→16px`, add `--text-2xs: 11px` (kills the 266 arbitrary `text-[10/11px]` over later phases). `CLAUDE.md` — cards spec `rounded-xl`→`rounded-2xl` (matches Card primitive + polished surfaces).

**1B PageHeader** (~30 lines): `components/ui/PageHeader.tsx` — add optional `eyebrow` prop (rendered as `text-xs font-semibold uppercase tracking-wide text-gold-muted`). `ui/EmptyState.tsx` needs no change (already compatible).

**1C Logo** (~100 lines):
- `components/marketing/Logo.tsx` — `BadgeSvg` gains `simplified` variant: drop 2 finial dots + garland, thicken arch stroke 2.1→~2.8 and pillars 2.5→~3.2, keep two-tone flame-heart. `LogoMark` auto-picks simplified when `size < 28`.
- `app/icon.svg` — regenerate with simplified geometry (favicon renders at 16px where current mark collapses).
- `app/apple-icon.tsx` — keep full detail (128px render), sync path data with Logo.tsx + comment noting manual sync.
- Place logo: `(app)/layout.tsx:44-49`, `(onboarding)/layout.tsx:12-17`, `(auth)/layout.tsx:59-63` — swap plain-text "Smart Shaadi" for `LogoFull` (compact size ~26).

Verify: type-check + build; open /login /register /dashboard onboarding at 375/1280; favicon hard-refresh; icon files may need sanctioned `eslint-disable no-restricted-syntax` (global-error.tsx pattern).

## Phase 2 — Navigation & i18n foundation (sequential) ✅ `1617a98`

- `components/layout/nav-config.ts` — export shared `isNavActive(pathname, href)` (slash-boundary + `/dashboard` exact-match carve-out); add `/vendor-dashboard/rentals` to `VENDOR_MORE_GROUPS.groupBusiness` (reuses existing `rentals` key + `Package` icon; demo-filter safe automatically).
- `AppNav.client.tsx` — use `isNavActive`; i18n the 3 hardcoded aria-labels (`t('primaryNav')`, `t('moreNavigation')`, `t('closeMenu')`); focus trap in More sheet + return focus to trigger; `focus-visible` rings on primary links.
- `TopNav.client.tsx` — use `isNavActive`; active style `bg-primary/10 text-primary` → `bg-teal/10 text-teal` (unify on teal); `aria-current` + active highlight on More dropdown items + active-trigger state.
- `components/wedding/WeddingSidebar.client.tsx` — add `calendar` entry to Planning group (import `Calendar` icon).
- `messages/en.json` + `hi.json` — 3 new `nav.app` keys: `primaryNav`, `closeMenu`, `moreNavigation` (flag Hindi for native review).

Verify: build; nav at 375/1280 across roles via RoleSwitcher; focus trap Tab/Escape; teal active on both surfaces; `/hi/` aria-labels; VENDOR sees Rentals; wedding sidebar Calendar works.

## Phase 3 — Area sweeps (8 file-disjoint packages) 🔶 in progress, inline

> Partial checkpoint `1c7df30` landed: error/loading.tsx for 8 admin sub-routes; loading.tsx
> for assistant/weddings/welcome; page passes on admin/escrow, bookings, likes, weddings list;
> UserMenu + AvailabilityCalendar touch-ups. UNVERIFIED — type-check/review before building on it.

**Uniform sweep pattern per page:** `ui/PageHeader` (canonical H1), motion (`PageTransition`/`FadeUp`/`StaggerList` — never `useReducedMotion()` in `initial`), lucide icons (no inline SVG/emoji/literal arrows), `ui/EmptyState` (+illustration `variant` where preset fits), card pattern `rounded-2xl border-gold/20 bg-surface shadow-card`, `Container`/consistent widths, `text-2xs` for micro-labels, Button/Badge adoption + 44px touch targets, i18n where missing.

**⚠ i18n protocol:** merge new keys into BOTH `en.json`/`hi.json` in the same edit session, validate JSON + en/hi key parity after each merge (script pattern: flatten both, compare key sets), commit per-package.

| Pkg | Scope | Highlights |
|---|---|---|
| **A Vendor** | `vendor-dashboard/**`, `vendor/**` | Worst cluster: i18n from zero, inline SVGs→lucide, hand-rolled stats→StatCard, "coming soon" treatment, pipeline gets RoleHero/EmptyState/motion, unify vendor page-guard pattern. 2 commits |
| **B Admin** | ALL of `admin/**` EXCEPT `admin/users` (reference standard), incl. root page + analytics/audit/revenue/vendors, `components/admin/**` | Bring to admin/users standard: PageHeader, PageTransition, i18n, lucide back-arrows; shared→ui PageHeader/EmptyState migrations; raw tables→DataTable per-table judgment. 2-3 commits |
| **C Weddings** | `weddings/**`, `components/wedding/**` | H1s, motion, layout width wrapper at ALL breakpoints (not just `lg:`); **DayOfDashboard full pass** (rounded-md, bg-foreground off-palette, 4 sub-44px buttons); expenses/vendors table eval; weddings-list loading.tsx. 3 commits |
| **D Commerce** | `bookings/**`, `store/**`, `rentals/**`, `payments/**` | **rentals pagination raw `<a>`→ i18n `Link` (locale bug)**, dead inrFormatter, emoji/literal-arrow→lucide, payments bespoke shell→PageHeader/Container, invoices/[id] table, shared→ui migrations. 2 commits |
| **E Settings** | `settings/**`, `ui/UserMenu.client.tsx` | **New `/settings/page.tsx` index** (card links to sub-pages); UserMenu Settings→`/settings`; sub-page header unification; referral raw table→DataTable + `smartshaadi.in`→`smartshaadi.co.in`. 2 commits |
| **F Social** | likes, shortlist, viewers, requests, notifications, matches | H1 normalization + shared→ui EmptyState. 1 commit |
| **G Core hubs** | dashboard, feed, coordinator/**, family/**, support/** | dashboard internal radius split fix, feed/MatchFeed EmptyState migration, extra care (highest traffic). 2 commits |
| **H Misc** | sitemap.ts, loading.tsx gaps, font fixes | Remove `/pricing` from sitemap (NOT middleware — too risky); assistant/welcome loading.tsx; `font-['Playfair_Display']`→`font-heading` (ProfilePhotoUploader:400); CompatibilityDisplay:134 →`font-heading` (visual-verify); **leave lines 355/410/523 inline** (font-hindi is serif, would change weight). 1 commit |

Per-package verify: type-check + build + representative pages at 375/1280 in `/en/` AND `/hi/` + role via RoleSwitcher. Package D regression: `/hi/rentals` pagination stays locale-prefixed.

## Phase 4 — Dead code deletion (sequential, after Phase 3)

Delete: `(profile)/create/page.tsx` (+ group layout files if nothing else uses them), `(onboarding)/divorcee-widow/{page.tsx,actions.ts}`, `components/onboarding/DivorceeWidowOnboarding.client.tsx`.
- Re-grep for references immediately before deleting (must return only the deleted files).
- Use `git rm ':(literal)...'` for bracketed paths.
- Verify: build clean; `/create` + `/onboarding/divorcee-widow` 404 (not 500).

## Phase 5 — Consolidation (sequential, after 3+4)

1. Re-grep zero remaining `shared/PageHeader` + `shared/EmptyState` consumers.
2. Fix `shared/DataTable.tsx` EmptyState import → `ui/EmptyState` **before** deleting.
3. Delete `shared/PageHeader.tsx`, `shared/EmptyState.tsx`; update `shared/index.ts` barrel.
4. Skeleton unification: `ui/skeleton.tsx` base → `.skeleton-warm` treatment (cascades to all shared composites, zero consumer edits).
5. Avatar: migrate `ProfileImage.client` consumers → `ImageWithFallback`/`InitialAvatar`; keep Radix `ui/avatar.tsx`.

## Phase 6 — Residual card-radius mop-up (sequential)

Files with card pattern (`rounded-xl` + `border-gold/*`/`bg-surface`/`shadow-card`) NOT touched by Phase 3 (compute via `git diff --name-only` vs grep list). Manual review per match — NO blind sed (inputs/buttons keep their radius). Standardize card border `border-gold/20`, shadows → `shadow-card` (auth `shadow-xl`, bookings `shadow-sm` included).

## Phase 7 — Final verification (CLAUDE.md protocol + pre-push gate)

```bash
pnpm type-check && pnpm --filter @smartshaadi/api type-check
pnpm lint && pnpm test && pnpm e2e
pnpm --filter web build   # never while dev server runs (DrvFs)
```
Browser at 375 + 1280 (prod build+start or dev --turbopack):
- All 8 package representative pages; all 6 roles via RoleSwitcher — no 500s, no console errors.
- Regression: `/hi/rentals` pagination; `/pricing` absent from sitemap.xml; deleted routes 404; `/settings` index + all 6 sub-pages reachable via UserMenu.
- Demo mode: `NEXT_PUBLIC_DEMO_MODE=true` hides store/rentals/admin/vendor-dashboard nav incl. new rentals entry.
- Hindi spot-check 1 page per package — no raw keys/English leaks.
- QA login qa-ind-01 (+917000000001/123456) against docker stack.

Commits: pathspec-explicit (`git commit -- <paths>`, `:(literal)` for brackets), ≤1000 lines each.

## Key risks

1. **en/hi key drift** → runtime MISSING_MESSAGE; mitigated by centralized merge + parity check script.
2. **RSC inline-function props** — compile fine, 500 in prod; browser pass mandatory per package.
3. Radius sweep false positives — co-occurrence scoping + manual review.
4. DataTable hidden EmptyState dep — fix import before delete (ordered in Phase 5).
5. Focus-trap regression on AppNav sheet — test Tab cycle/Escape/release.
6. Middleware untouched by design (pricing fix = sitemap-only).

---

# Annex — Phase 3 canonical page recipe (former sweep-agent brief)

Apply to every page in each package's scope. Repo root: `/mnt/d/Do Not Open/vivah/vivahOS`.

## Canonical page recipe

1. **Header**: `import { PageHeader } from '@/components/ui/PageHeader'` — props `title`, optional `description`, optional `eyebrow` (11px uppercase gold kicker), optional `actions` (ReactNode). Canonical H1 is inside it: `font-heading text-[22px] sm:text-[28px] font-semibold text-primary`. Never hand-roll an H1. Do NOT import from `@/components/shared/PageHeader` (deprecated — being deleted).
2. **Motion**: wrap page content in `PageTransition` (`@/components/motion/PageTransition.client`) where absent; lists that map cards → `StaggerList` (`@/components/motion/StaggerList.client`); single hero blocks → `FadeUp` (`@/components/shared/FadeUp.client`). NEVER call `useReducedMotion()` inside a motion `initial` prop (hydration bug). Server pages stay server — motion wrappers are client components composed around server-rendered children.
3. **Empty states**: `import { EmptyState } from '@/components/ui/EmptyState'` — never `shared/EmptyState` (deprecated). Use illustration `variant` when a preset fits.
4. **Cards**: `rounded-2xl border border-gold/20 bg-surface shadow-card p-4 sm:p-6`. Fix drift: `rounded-xl`/`rounded-lg` cards, `border-gray-*`, `bg-white`, `shadow-sm/md/xl` on cards → `shadow-card`. Inputs/buttons KEEP their own radius (`rounded-lg`) — only cards change.
5. **Buttons**: `ui/button` Button, default h-11 (44px). Any custom clickable ≥44×44px touch target. Links styled as buttons use `buttonVariants`.
6. **Badges**: `ui/badge`, rounded-full.
7. **Micro-labels**: `text-[10px]`/`text-[11px]` → `text-2xs` token (11px, exists in globals.css).
8. **Tables**: raw `<table>` → `shared/DataTable` where it fits (judgment call per table; skip if table has heavy custom cells).
9. **Layout**: consistent max-width wrapper (`Container` or the page-group's established `mx-auto max-w-*` pattern) at ALL breakpoints.
10. **Icons**: lucide-react only. Replace inline SVG, emoji glyphs, literal arrows (`→`, `←`, `»`).
11. **Colors**: design tokens only — `bg-primary`, `text-teal`, `border-gold/20`, `bg-background`, `text-gold-muted`, `bg-surface`, `text-muted-foreground`. Never raw hex, never `bg-white`/`bg-gray-*`/`text-blue-*`.
12. **i18n**: pages already using `useTranslations`/`getTranslations` — keep. Pages with hardcoded English strings: replace with `t('...')` calls under the area namespace; add keys to BOTH en.json + hi.json with parity check.
13. **Loading states**: add `loading.tsx` (skeleton via `ui/skeleton` composites) where a data page lacks one.
14. **a11y**: `aria-current` on active nav-ish links, `aria-label` on icon-only buttons, `focus-visible:ring-2 focus-visible:ring-teal` on interactive elements, `aria-hidden` on decorative icons.

## Working rules

- Commits pathspec-explicit (`git commit -- <paths>`, `:(literal)` for bracketed paths), ≤1000 lines each.
- No builds while a dev server runs (DrvFs `.next` clobber).
- TypeScript strict: no `any`. Server Components by default; `.client.tsx` only when hooks/browser APIs needed. Never pass inline functions from server → client components (prod 500).
