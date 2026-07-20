# UI Overhaul — Day 5-6 Notes & Day 7 Follow-ups

Day 5-6 polished the 3 remaining high-traffic surfaces on top of the Day-1
primitives, matching the Day 2-4 luxury-Indian-matrimonial visual language.
Built by 3 parallel background teammates (clean domain split); verify + commits
+ push centralized by the orchestrator (WSL git-index race avoidance).

## Shipped

| Track | Surface | Files |
|---|---|---|
| 1 Profile detail | `(app)/profiles/[profileId]/` | `page.tsx` (2-col rewrite), `PhotoGallery.client.tsx` (lightbox+swipe+protected placeholder), **new**: `ProfileCompatibilityCard.tsx`, `ProfileDetailTabs.client.tsx`, `ProfileActions.client.tsx`, `ProfileDetailSkeleton.tsx` |
| 2 Dashboards | `(app)/dashboard/`, `(app)/vendor-dashboard/` | `dashboard/page.tsx`, `vendor-dashboard/page.tsx`, **new**: `components/dashboard/RevenueSparkline.client.tsx` (pure-SVG) |
| 3 Admin | `(app)/admin/` | `page.tsx` (role guard + `force-dynamic` preserved), **new**: `AdminRefreshButton.client.tsx`, `AdminDisputesMini.client.tsx`, `AdminHealthAndRisk.client.tsx` |

## Brief corrections applied (recorded for future tracks)

- Route is `(app)/profiles/[profileId]/` (not `[id]`); no `(vendor)`/`(admin)`
  route groups — admin = `(app)/admin/`, vendor dash = `(app)/vendor-dashboard/`.
  Shared `(app)/layout.tsx` shell (bottom AppNav + sticky header, no sidebar).
- `GET /matchmaking/score/:profileId` has **no per-factor 8-Ashtakoot data** —
  rendered the real 6-factor `breakdown` bars + `gunaScore` scalar (X/36 · tier)
  + `explainer` reasons instead. No fabricated koota pills.
- No `/users/me`, no `firstName` — greeting uses `personal.fullName` with a
  name-less fallback.
- No endpoints for: vendor-approval queue, GMV/revenue totals, active-matches
  count, audit/activity feed, signup/GMV time-series — rendered honest
  "coming soon" placeholders with commented `// TODO`, never fake numbers.
- Admin health strip is **real**: API `/ready` (postgres/redis/mongo) dots.
- No recharts — pure-SVG (BudgetDonut precedent).

## Deviations from brief (intentional)

1. **Profile `VerificationStrip`**: `ProfileMetaResponse.verificationStatus` is a
   single string enum, not per-flag. All 4 trust chips (Phone/KYC/Photo/Govt-ID)
   light/dim together on `verificationStatus === 'VERIFIED'`. Per-flag chips
   need an API field that does not exist yet.
2. **`ProfileHero`** replaced with inline JSX in `page.tsx` (2-col layout needs
   the name at ~32px Playfair in the left column, outside the hero card's fixed
   aspect-ratio image). `components/profile/ProfileHero.tsx` left untouched and
   still used elsewhere (MatchProfileDrawer).
3. **Admin 4th stat tile** (Active disputes) is a raw `<div>` not `StatCard` —
   needs conditional destructive/success colouring `StatCard`'s fixed
   `text-primary` can't express. Same real data, same visual weight.
4. **Admin at-risk users** section co-located inside `AdminHealthAndRisk.client.tsx`
   (shared server fetch) rather than a standalone `<section>` — renders as a
   visually distinct sub-section regardless.
5. **Customer dashboard quick-actions**: custom 4-tile grid instead of the old
   `components/dashboard/QuickActions.tsx` (kept, now unused). `ActivityFeed.tsx`
   usage dropped (component kept, now unused) — replaced by a domain-correct
   "Recent Conversations" section with `EmptyState`.
6. **`KebabMenu` `profileId` prop dropped** during integration: Report/Block are
   deliberate UI-only TODOs (no endpoint). Prop removed to keep the build
   lint-clean; TODO comments note to re-add it when the endpoints land.

## Integration fixes (orchestrator)

4× TS6133 resolved: dead `Link` import (AdminHealthAndRisk), dead `primaryPhoto`
const (profile page), dead `ProfileSections` import (ProfileDetailTabs), unused
`profileId` prop (ProfileActions KebabMenu — see deviation 6). Type-check 0
errors after fixes.

## Day 7 follow-ups

- [ ] **Manual visual QA** at 375 px (iPhone SE) and 1440 px across all 3 new
      surfaces + cross-track consistency (heading sizes, card padding, motion
      timing). Requires a running dev server — **not done** (flaky on WSL
      DrvFs). High priority before sign-off.
- [ ] **`ProfileDetailSkeleton.tsx` is currently unused** — the profile page is
      a Server Component with no `loading.tsx`/Suspense boundary. Either add
      `(app)/profiles/[profileId]/loading.tsx` re-exporting it, or wrap the
      async sections in `<Suspense>`. Dead until then.
- [ ] **Dead components**: `components/dashboard/QuickActions.tsx` and
      `ActivityFeed.tsx` are no longer rendered. Decide: delete or re-home.
- [ ] **No-endpoint TODOs to wire when the API lands**: profile shortlist /
      report / block; vendor-approval queue; admin GMV / active-matches /
      audit-activity feed + signup/GMV time-series charts; vendor revenue
      analytics breakdown (currently client-derived from the bookings array).
- [ ] **AI-service health card** omitted from the admin health strip (web has
      no AI base URL env). Add `NEXT_PUBLIC_AI_SERVICE_URL` + render the
      `models` map if a richer health view is wanted.
- [ ] Per-flag KYC verification fields on `ProfileMetaResponse` → enables the
      true 4-chip trust strip (deviation 1).
