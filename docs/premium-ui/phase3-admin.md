# Premium UI Phase 3 — Admin Audit (Admin Dashboard & Operations)

Audited 2026-07-20 on `feat/premium-ui-phase-1`, inspecting code across:
- `/admin` hub (page, KYC, users, kyc detail, analytics, vendors, revenue, refunds, payouts, escrow, reconciliation, audit, settings, cities, promos, packages, marketing, gaps, retention)
- `apps/web/src/components/admin/` component library
- `apps/web/src/components/analytics/` chart components used by admin

This audit covers internal-only desktop-first (but tablet-working) admin UI — success is data legibility, consistency, clear action affordances, and design-token compliance. Admin is operations-focused, not delightful; no animation except card hover.

---

## Cross-cutting Findings

| # | Severity | Finding | Category | Fix |
|---|---|---|---|---|
| A1 | High | **Missing generateMetadata on 13 admin pages** — kyc, users, analytics, vendors, payouts, refunds, revenue, promos, reconciliation, audit, escrow, settings, main /admin. Browser tabs show generic marketing title. | Metadata | Add per-page metadata for each top-level admin route (follow cities/gaps/marketing pattern: `async function generateMetadata({ params })` returning `{ title, description }` from i18n). |
| A2 | High | **All admin loading.tsx use generic RouteSkeleton** — no layout-matched skeletons. Tables load as generic 8-row skeleton; hub loads as 6-row skeleton regardless of actual layout. | Layouts | Create TableSkeleton, CardSkeleton, StatCardSkeleton variants; replace RouteSkeleton with layout-matched skeletons. E.g., hub should show 2 hero + 4 stat card skeleton + 3 card section skeletons. |
| A3 | High | **Status badge colours inconsistent across tables** — KYC uses riskBadgeClass (success/warning/destructive), refunds use status-tabs (primary), users use role/status pills. No unified semantic mapping. | Design tokens | Unify all status chips: (1) map vendor/refund/payment status to semantic tokens (success/warning/destructive/teal/gold); (2) create a shared `StatusChip` component; (3) audit all admin tables + escrow + reconciliation + promos for consistent usage. |
| A4 | Med | **Table overflow not wrapped** — KycQueueTable, many others render `min-w-[720px]` but no `overflow-x-auto` container wrapping. Will break on tablets <800px. | Responsive | Wrap all data tables in `<div className="overflow-x-auto">` with sensible `min-w-*` on `<table>`. Min-width should be ~600–720px depending on column count. |
| A5 | Med | **No explicit hover state on table rows** — KycQueueTable has `hover:bg-background/50`, others are missing. Admin rows should lighten on hover to signal clickability. | Interaction | Add `hover:bg-background/50` + subtle text color shift (text-primary on hover) to all table rows and card list items. |
| A6 | Med | **Empty states missing branded illustrations** — KycQueueTable, UsersTable, vendor queue all use generic "no data" text. Branded EmptyState illustration set exists in `components/ui/illustrations/`. | Visual polish | Wire `variant="no-kyc"` / `variant="no-users"` / `variant="no-vendors"` EmptyState calls where available. Where illustrations don't exist (reconciliation, audit), keep text but upgrade to inline SVG icon. |
| A7 | Med | **Chart text sizing for legibility** — analytics charts (OverviewCards, SignupsChart, etc.) have no explicit font-size constraints. Axis labels, legends may be <2xs on mobile. | Charts | Pin chart label text to `text-2xs` (10px) minimum; verify legend items are ≥2xs; ensure colour contrast (muted-foreground on surface ≥4.5:1 WCAG-AA). |
| A8 | Low | **Dangerous actions lack confirm affordances** — User ban/suspend uses destructive button; refund reject, vendor reject, KYC reject have minimal affordance. | UX pattern | Add confirm dialog/toast for: user suspend/ban, refund reject, vendor reject, KYC reject. Destructive buttons should trigger modal or disable + second confirmation step. |
| A9 | Low | **Breadcrumbs inconsistent** — KYC detail page has back link but no breadcrumb. Analytics/revenue/refunds have breadcrumbs, hub has none. | Navigation | Add breadcrumbs to all major admin sections (admin → users/kyc/vendors/etc.), unify formatting. Hub page gets breadcrumbs omitted (it's root). |
| A10 | Low | **Pagination controls <44px** — users/vendors pages use Link + text; 30px click target. | Touch targets | Ensure all pagination buttons (prev/next) hit ≥44px. Wrap in larger button if needed. |

---

## Hub (`/admin`)

**Strengths:** clear 4-section layout (system health, metrics, queues, analytics), colour-coded stats (teal/gold/success), inline queue tables, quick-nav grid.

- **H1**: No generateMetadata — tab shows "Smart Shaadi" instead of "Admin Console".
- **H2**: Platform Metrics stat cards (4 in a row) — add `hover:shadow-card-hover hover:-translate-y-0.5` lift + gold-glow for premium feel (A5 family). Currently only analytics card has hover lift.
- **H3**: AdminHealthAndRisk section is solid; note TODO comments about AI service health (unreachable from web layer).
- **H4**: Action Queues section — KYC card, Disputes card, Vendor Approvals card render well but lack row-hover (A5).
- **H5**: Recent Activity list — divide-y divider and icon treatment solid; text sizing good (2xs labels OK here).
- **H6**: Quick nav grid (13 tiles) — some marked `href="#"` (Coming soon) with opacity-60 + pointer-events-none — good pattern.

---

## KYC Console (`/admin/kyc` + `/admin/kyc/[profileId]`)

**Strengths:** KycQueueTable with filter pills + risk scoring, KycStatsBar breakdown, link-out to detail page.

- **K1**: No generateMetadata on `/admin/kyc`.
- **K2**: KycQueueTable filtering + sorting (by risk score) — solid UX. Consider adding: sort affordance (chevron on header), column visibility toggle for mobile.
- **K3**: Filter pills (All, High Risk, Low Risk, Duplicates, Sanctions) — 30px tall, below 44px. Wrap in `h-9` button group.
- **K4**: Risk badge coloring (riskBadgeClass) — score ≥80 = success (green), 50–79 = warning (amber), <50 = destructive (red). Correct semantic mapping, but verify contrast: white text on destructive-red needs ≥4.5:1.
- **K5**: Action buttons (View, Approve, Reject) — 30px tall + gap-1.5 clusters. Increase to `h-9` for touch target (A10).
- **K6**: `/admin/kyc/[profileId]` detail page has header, KycActionsPanel (approve/reject/appeal UI), KycAppealResolver, AuditTimeline. No generateMetadata. Missing back-link breadcrumb styling consistency (uses SVG instead of `<ArrowLeft>`).

---

## Users (`/admin/users`)

**Strengths:** DataTable component with selection, bulk suspend/reactivate with modal, CSV export.

- **U1**: No generateMetadata.
- **U2**: UserFilters.client.tsx — search input + role/status dropdowns solid.
- **U3**: UsersTable uses DataTable component; columns (name, role, status, joined) render correctly. Rows lack hover state (A5).
- **U4**: Bulk action row — destructive (suspend) + success (reactivate) buttons good; reason input solid. Touch targets OK (h-9).
- **U5**: Pagination (prev/next links) — 30px click target (A10), should wrap in h-9 button or increase link padding.

---

## Analytics (`/admin/analytics` + `/admin/analytics/forecast`)

**Strengths:** OverviewCards (4 stats), SignupsChart, MatchActivityChart, StayQuotientChart, RevenueChart, TopMatchesTable, DateRangeFilter, ExportButton.

- **A1**: No generateMetadata on either analytics page.
- **A2**: OverviewCards — StatCard component with trend %'s; solid baseline.
- **A3**: Charts (Signups, Match Activity, Revenue) — assuming recharts / plotly; verify:
  - Axis labels (dates, numbers) are ≥2xs (10px).
  - Legend text is ≥2xs.
  - Series colours use design tokens (not raw `#FFA500` or `rgba(0,0,0,0.2)`).
  - Tooltip text has adequate contrast.
- **A4**: DateRangeFilter + ExportButton — buttons solid; filter UX should match preset tabs + custom date input.
- **A5**: TopMatchesTable — verify column widths + row hover.

---

## Vendors (`/admin/vendors` + `/admin/vendors/[id]`)

**Strengths:** Status tab strip (PENDING / UNDER_REVIEW / APPROVED / REJECTED / SUSPENDED), card-based list (no table — good for mobile), urgency-coloured "days in queue".

- **V1**: No generateMetadata on vendors page.
- **V2**: Status tab strip — good hover/active state; verify touch targets (py-2 = ~24–32px; increase to h-9 if <44px).
- **V3**: Vendor cards — link wrapper, business name heading, category + city secondary text, submitted date + urgency status. Hover state: `hover:-translate-y-0.5 hover:shadow-card-hover` — solid. Rejection reason shown (red text) when status=REJECTED.
- **V4**: Urgency colouring (daysSince urgencyClass) — muted (<3d), warning (3–7d), primary+bold (7+d) — good colour mapping.
- **V5**: [id] detail page (VendorReviewActions.client.tsx) — approve/reject actions; verify confirmation affordances (A8).

---

## Refunds (`/admin/refunds`)

**Strengths:** Status tab switcher (REQUESTED / APPROVED / PROCESSING / COMPLETED / REJECTED / FAILED), per-refund card list, approve/reject decision modals.

- **R1**: No generateMetadata.
- **R2**: AdminRefundsClient tabs — good active/inactive state; verify touch targets (py-1.5 = ~20–24px; should be h-9).
- **R3**: Refund card list — customer info, amount, reason, status, action buttons. Layout solid.
- **R4**: Status mapping (REQUESTED → "Pending", etc.) — verify consistency with refund model (check types/RefundRecord).
- **R5**: Decision modal (approve/reject with notes input) — good UX. Add confirm toast after decision.

---

## Revenue (`/admin/revenue`)

**Strengths:** Date range filter, summary cards (total revenue, subscriptions, vendor payouts, escrow held), daily revenue chart, top vendors table.

- **R1**: No generateMetadata.
- **R2**: Summary cards (4-column grid) — StatCard rendering revenue figures + trend %; solid.
- **R3**: Daily revenue chart (RevenueChart) — verify axis label sizing (A7).
- **R4**: Categories pie/donut chart (RevenueByCategory) — colour-code by revenue segment; verify legend readability.
- **R5**: Top vendors table — vendor name, revenue, payouts, booking count; verify overflow wrapping + row hover (A4, A5).
- **R6**: Liabilities section — summary cards for payouts due, escrow held, pending refunds — good data separation.

---

## Payouts (`/admin/payouts`)

**Strengths:** Status tabs (PENDING / PROCESSING / COMPLETED / FAILED), payout card list with vendor info + amount + scheduled date.

- **P1**: No generateMetadata.
- **P2**: Status tabs — verify touch targets (A10).
- **P3**: Payout cards — vendor name, amount, scheduled date, status badge. Hover state solid.
- **P4**: Action buttons (process, fail, retry) — verify confirm modal for destructive actions (A8).

---

## Escrow (`/admin/escrow`)

**Strengths:** Dispute list, ResolveDisputeRow.client.tsx with action buttons (approve vendor / refund customer / custom split).

- **E1**: No generateMetadata.
- **E2**: DisputeTableClient.client.tsx — verify table overflow (A4) + status badge consistency (A3).
- **E3**: Dispute row status (OPEN / RESOLVED / DISPUTED) — verify semantic colour mapping.
- **E4**: Action buttons (Approve Vendor, Refund Customer, Custom Split) — verify confirm affordance (A8).

---

## Reconciliation (`/admin/reconciliation`)

**Strengths:** Reconciliation records (booking ID, payment status, settlement status, discrepancy flag).

- **C1**: No generateMetadata.
- **C2**: ReconciliationTableClient.client.tsx — verify table styling (A4, A5) + status badges (A3).
- **C3**: Discrepancy highlighting — high-contrast flag or red text for records with mismatches.

---

## Audit Log (`/admin/audit`)

**Strengths:** Event type filter (ACTION_TYPE), entity type filter, date range, user actor filter, CSV export.

- **A1**: No generateMetadata.
- **A2**: AuditFilters.client.tsx — dropdowns + date input solid.
- **A3**: Audit table — event type, entity type, actor name, timestamp, details (JSON snippet). Verify table overflow (A4).
- **A4**: AuditExportButton.client.tsx — CSV export solid.

---

## Settings (`/admin/settings`)

**Strengths:** PlatformSettingsForm.client.tsx — form inputs for feature flags, rate limits, etc.

- **S1**: No generateMetadata.
- **S2**: Form — verify field styling (labels, inputs, help text) matches design system. Buttons: verify save/reset touch targets (A10).
- **S3**: Sensitive settings (API keys, webhook URLs) — mask/reveal pattern; verify copy-to-clipboard UX.

---

## Promos (`/admin/promos`)

**Strengths:** AdminPromosClient.client.tsx — promo list with code, discount amount, status (ACTIVE / EXPIRED / DRAFT), actions (edit, activate, deactivate).

- **P1**: No generateMetadata.
- **P2**: Promo table/card list — verify status badge colours (A3).
- **P3**: Action buttons (activate, deactivate, edit) — verify confirm modal for activate/deactivate (A8).

---

## Cities (`/admin/cities` + `/admin/cities/[id]`)

**Strengths:** CityNetwork.client.tsx (network graph visualization), city detail page with supply stats + vendor breakdown.

- **C1**: HAS generateMetadata ✓.
- **C2**: CityNetwork — graph rendering; verify text sizing for node labels (A7).
- **C3**: City detail page (CityDetail.client.tsx) — supply metrics, top vendors by bookings, market analysis. Verify table styling (A4, A5).

---

## Marketing (`/admin/marketing` + `/admin/marketing/[id]`)

**Strengths:** MarketingOverview.client.tsx (campaign list), CampaignTable, campaign detail with send history + analytics.

- **M1**: HAS generateMetadata ✓.
- **M2**: Campaign table — status badges (DRAFT / SCHEDULED / SENT / FAILED). Verify colours (A3).
- **M3**: CampaignSendsTable.client.tsx — recipient list with send status + click rate. Verify table overflow (A4).
- **M4**: CampaignForm.client.tsx — form inputs solid; verify field styling.

---

## Packages (`/admin/packages`)

**Strengths:** AdminPackageTable.client.tsx — package list with city, tier (ESSENTIAL / SIGNATURE / LUXE), price, supply (Placeholder / Real), visibility (Live / Hidden), promote/demote actions.

- **P1**: HAS generateMetadata ✓ (as "adminPackages").
- **P2**: Table columns — city, tier, price, supply, visibility. Verify overflow (A4) + row hover (A5).
- **P3**: Promote/Demote buttons — destructive actions triggering modal with confirmation text. Solid UX.

---

## Gaps (`/admin/gaps`)

**Strengths:** Gap analysis by city + threshold filter (GapThresholdFilter.client.tsx).

- **G1**: HAS generateMetadata ✓.
- **G2**: Gap visualization — bar chart or table showing unmet demand by city/category. Verify chart labels (A7).
- **G3**: Filter — threshold slider + category/city selectors.

---

## Retention (`/admin/retention`)

**Strengths:** RetentionOverview.client.tsx — cohort retention data (week-over-week re-engagement), churn signals, stay quotient distribution.

- **R1**: HAS generateMetadata ✓.
- **R2**: Retention table/chart — verify axis labels (A7) + data legibility on small screens (tablets).

---

## Design System Violations (None found in main code paths)

✓ No raw hex colours (`#FFA500`, `#FF0000`) in admin code.
✓ No generic `bg-white`, `bg-gray-*`, `bg-blue-*` in admin code.
✓ All surface containers use `bg-surface`, `bg-background` tokens.
✓ Text uses `text-primary`, `text-muted-foreground`, `text-text-muted` tokens.

Minor concerns:
- Charts (if using inline colour specs) may use `rgba()` — acceptable for series colours but should be reviewed.
- Some components reference `text-primary` instead of `text-text-primary` (older pattern); both valid but should unify.

---

## Component Library Issues

### `KycQueueTable.client.tsx`
- Filter pills: 30px → increase to h-9 (36–40px).
- Action buttons: 30px → increase to h-9.
- Hover state: has `hover:bg-background/50` ✓.
- Empty state: generic text → wire to EmptyState variant (A6).
- Table overflow: wrapped ✓.

### `UsersTable.client.tsx`
- Uses DataTable component (reusable) ✓.
- Bulk action bar: h-9 ✓.
- Pagination buttons: Link elements, 30px → wrap in h-9 or use Button component (A10).

### `AdminHealthAndRisk.client.tsx`
- Status indicator cards: solid design.
- Risk band colouring (riskBandClass): HIGH/CRITICAL → destructive, MEDIUM → warning, else muted. Good (A3).

### `KycStatsBar.tsx`
- Stat boxes (pending, verified, rejected, etc.) — compact horizontal layout. Touch target OK (py-2 on smaller text).

### `ReputationCard.tsx`
- Reputation score display; solid baseline.

### `badges.tsx`
- RolePill, UserStatusPill, and other badge components — verify colour mapping (A3). If using hardcoded colours, unify via `StatusChip` component.

---

## Summary of Changes

### Tier 1 (High Priority)
1. Add generateMetadata to 13 admin pages (all except hub which is root).
2. Create layout-matched skeletons for admin sections (TableSkeleton, CardSkeleton, StatCardSkeleton).
3. Unify status badge colours across all tables via shared StatusChip component.
4. Wrap all tables in `overflow-x-auto` containers.
5. Increase filter pill + action button touch targets to ≥44px.

### Tier 2 (Medium Priority)
6. Add row-hover state (`hover:bg-background/50`) to all table rows + card lists.
7. Wire branded EmptyState illustrations to empty states.
8. Verify chart axis/legend text sizing (≥2xs).
9. Add confirm modals for destructive actions (suspend, reject, ban).
10. Verify pagination button touch targets.

### Tier 3 (Polish)
11. Add breadcrumb components to major sections.
12. Hover lift + gold-glow to stat cards.
13. Unify back-link styling (use `<ArrowLeft>` icon + text consistently).

---

## Testing Checklist

- [ ] All admin pages load without console errors.
- [ ] Stat cards, tables, charts render on 375px (mobile) and 768px (tablet) without layout breaks.
- [ ] Table overflow: scroll affordance (fade-edge or scrollbar) visible on <720px widths.
- [ ] Dangerous action buttons (reject, ban, suspend) trigger confirm dialog before acting.
- [ ] Status badges consistently use semantic colours (success/warning/destructive/teal/gold).
- [ ] Empty states show branded illustration variant where available.
- [ ] All interactive elements (buttons, filter pills, pagination) are ≥44×44px.
- [ ] Chart axis labels and legend text are readable at 375px.
- [ ] Hover states (shadow-card-hover, -translate-y-0.5) trigger on desktop.
- [ ] Dark mode: all surfaces, text, badges render correctly with no raw `#FFF` or `#000` bleed-through.

