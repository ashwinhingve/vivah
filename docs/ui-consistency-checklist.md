# UI Consistency Checklist — Day 7 audit

Audited the 7 sprint surfaces against the design-system baseline. ✅ = matches,
❌ = deviated (fixed this commit), ➖ = N/A / intentionally bespoke.

Legend of properties:
- **H1**: `font-heading font-semibold text-primary text-[22px] sm:text-[28px]`
- **bg**: page root uses `bg-background` (warm ivory), cards `bg-surface`
- **PT**: content wrapped in `<PageTransition>`
- **Stagger**: async stat/list rows wrapped in a `StaggerList`
- **Num**: numeric stats via `StatCard`/`AnimatedNumber` (not raw `{value}`)
- **Card**: `Card`/`border-gold/20 shadow-card`, `p-6` default
- **Motion**: timings sourced from `lib/motion-config.ts`

| Page | H1 | bg | PT | Stagger | Num | Card | Motion |
|---|---|---|---|---|---|---|---|
| `(marketing)/page.tsx` | ➖ bespoke hero | ✅ | ➖ marketing | ➖ | ✅ AnimatedNumber | ❌→note* | ✅ |
| `(app)/feed/page.tsx` | ✅ (already responsive) | ✅ | ✅ | ✅ (client grid) | ➖ prose | ✅ | ✅ |
| `(app)/weddings/[id]/page.tsx` | ➖ bespoke 32/36 hero | ✅ | ❌→✅ added | ✅ | ✅ StatCard | ✅ | ✅ |
| `(app)/profiles/[profileId]/page.tsx` | ❌→✅ (was `text-3xl`) | ✅ | ✅ | ➖ | ➖ | ✅ | ✅ |
| `(app)/dashboard/page.tsx` | ❌→✅ (was `text-2xl`) | ✅ | ✅ | ✅ | ✅ StatsCard | ✅ | ✅ |
| `(app)/vendor-dashboard/page.tsx` | ❌→✅ (was `text-2xl`) | ✅ | ✅ | ✅ | ⚠ perf-snapshot raw† | ✅ | ✅ |
| `(app)/admin/page.tsx` | ✅ uses `PageHeader` | ✅ | ✅ | ✅ | ⚠ disputes tile raw‡ | ✅ | ✅ |

\* Marketing `Pricing.tsx` uses `border-border` not `border-gold/20`, and
`Footer.tsx` jumped `grid-cols-2 → md:grid-cols-6` with no intermediate.
Footer fixed (added `sm:grid-cols-3`); Pricing border left as a deliberate
marketing-section variant (documented, not a content card).

† Vendor "Performance Snapshot" shows 3 raw `{count}` figures in a custom
card. Left as-is this commit (they are derived inline filters, not headline
metrics) — noted in UI-OVERHAUL-SUMMARY deferred list.

‡ Admin "Open Disputes" is a raw `<div>` (needs conditional destructive
colour `StatCard`'s fixed `text-primary` can't express) — intentional
deviation, documented Day 5-6.

## Motion convergence (PASS 3)
Before: `components/shared/{StaggerList,FadeUp}` ran 10px / 250ms / 70ms while
`components/motion/*` ran 4px / 180ms / 40ms — visibly different on pages that
mixed both. After: all five primitives import `lib/motion-config.ts`; both
namespaces now run the canonical 4px / 180ms, 40ms stagger, 200ms/8px page,
1s count-up. No page-level import churn.

## Token-name note (out of scope)
`text-muted-foreground` and `text-text-muted` both resolve to `#6B6B76`. Used
interchangeably across ~30 files. Cosmetic only — a mass rename is high-diff,
low-value; left for a dedicated cleanup. Documented, not changed.

## UX Audit Wave 1 — 2026-05-26

Wave 1 of the framework defined in `/root/.claude/plans/please-create-a-comprehensive-tender-gizmo.md`.
Pre-launch sweep of token violations, dead duplicates, accessibility baselines,
and admin nav coverage.

### Token violations remediated (raw hex → CSS custom property)

| File | Was | Now |
|---|---|---|
| `components/dpi/CompatibilityGauge.client.tsx` | `#7FA682 / #C5A47E / #7B2D42`, track `#E5E5E5` | `var(--color-teal / --color-gold / --color-primary)`, track `var(--color-border)` |
| `components/dpi/FactorBreakdown.client.tsx` | `#7FA682 / #C5A47E / #9B9BA5` | `var(--color-success / --color-gold / --color-fg-3)` |
| `components/fii/FiiDetailPanel.client.tsx` | 5 hardcoded label colours | `var(--color-primary / --color-gold / --color-teal / --color-success / --color-text-muted)` |
| `components/wedding/RsvpStats.tsx` | conic-gradient fallback `#E2E8F0` | `var(--color-border)` |
| `components/feed/MaritalStatusFilterToggle.client.tsx` | `bg-white` toggle thumb (×2) | `bg-surface` |

### Accessibility baseline added

| Surface | Change |
|---|---|
| `CompatibilityGauge` SVG | `role="img"` + `aria-label="Compatibility {percent}%. {label}."` (was `aria-hidden`) |
| `LoginForm` phone | `autoComplete="tel-national"` + `aria-describedby="phone-error"` |
| `RegisterForm` name + phone | `aria-invalid` + `aria-describedby="register-error"`; phone also `autoComplete="tel-national"` |
| `VerifyOtpForm` 6-digit cells | first cell `autoComplete="one-time-code"` (enables iOS/Android SMS auto-fill), `aria-label="OTP digit n of 6"`, `aria-invalid`, `aria-describedby="otp-error"` |

### Component dedup

- Deleted `components/matchmaking/MatchCard.tsx` (228 lines) — dead code, zero importers.
- Deleted `components/matchmaking/AnimatedFeedGrid.client.tsx` — only imported by the now-deleted MatchCard.
- Canonical: `components/matching/MatchCard.tsx` (used by `dashboard` + `feed`).
- `components/matchmaking/SimilarProfiles.tsx` retained (still used by `profiles/[profileId]`).

### Admin nav coverage

`components/layout/AppNav.client.tsx`:
- Added `ADMIN_PRIMARY` (4 items: admin / revenue / KYC queue / disputes).
- Added `ADMIN_MORE_GROUPS` (3 groups, 6 items: vendor approvals, analytics, payouts, refunds, promos, reconciliation, settings).
- Extended `showMore` logic to fire the More-sheet for `ADMIN` and `SUPPORT` roles (previously INDIVIDUAL-only).
- Coverage: 11 of 12 admin destinations reachable via primary nav structure (12th is detail page `/admin/kyc/[profileId]` drilled into from queue).
- i18n: 5 new keys (`kyc`, `analytics`, `reconciliation`, `vendorApprovals`, `groupOperations`) in both `en.json` and `hi.json`.

### Known issues flagged for Wave 2

- `${color}30` alpha-hex-suffix on CSS-var pattern in `RsvpStats.tsx` and `FiiDetailPanel.client.tsx` (`CompatibilityPill`) renders as invalid CSS — borders + backgrounds silently transparent. Pre-existing; requires refactor to `color-mix()` or Tailwind opacity utilities.
- Playwright `e2e/demo.spec.ts` predates the `/[locale]/` route prefix — uses `/signup` / `/matches` directly. Needs route rewrite before becoming part of CI.
- No axe-core. Wave 2 item: add `@axe-core/playwright` to all specs once locale routes are updated.

### Pre-push gate results (2026-05-26)

| Step | Status |
|---|---|
| `pnpm type-check` (all 5 packages) | ✅ clean |
| `pnpm lint` (web) | ✅ warnings only, all pre-existing |
| `pnpm test` (api + web) | ✅ 686 + 2 = 688 / 688 |
| `pnpm build` (web) | ✅ all routes generated |
| `pnpm e2e` | ⏸ deferred — needs running dev stack (Postgres seeded + Redis + Mongo + API on :4000) and locale-route spec rewrite |
| Manual 375 / 1280 browser check | ⏸ deferred — environment is headless |
