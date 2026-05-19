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
