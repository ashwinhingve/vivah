# Premium UI — Phase 4 Session Summary (2026-07-21)

Branches: `feat/premium-ui-phase-1` (shipped via PR #4) · `feat/premium-ui-phase-4` (this session's work).
Executed as orchestrator + 7 Opus teammates in two waves with strict file-ownership partitioning
(no worktrees — shared tree), per-agent i18n fragments merged by the orchestrator.

## Shared foundations (orchestrator, pre-fan-out)

- `components/ui/StatusChip.tsx` — tone wrapper over Badge (`success|warning|error|teal|gold|neutral|primary`).
  Call sites own their `Record<Status, StatusTone>` maps; labels come i18n'd from the call site.
- `components/shared/AdminTableSkeleton|AdminPageSkeleton|ChartSkeleton` — layout-matched loading presets.
- `EmptyState` `no-products` variant + `NoProductsIllustration`; Badge `rating` variant.

## Wave 1 (5 teammates)

| Agent | Area | Highlights |
|-------|------|-----------|
| T1 | Admin console | badges.tsx → StatusChip (roles + statuses), escrow/reconciliation/KYC chips, 16 admin `loading.tsx` layout-matched, chart text ≥10px, SignupsChart/TopMatchesTable mounted guards |
| T2 | Payments + bookings | First `/payments` audit ever: token pass + StatusChip + full i18n (main, wallet, invoices, invoice detail, refunds, success, failure) — was zero keys; bookings STATUS_VARIANT → StatusChip |
| T3 | Store/rentals/vendor-dashboard | Orders STATUS_CONFIG + StatusBanner → StatusChip, rentals EmptyState, RentalCard `/api/media/`→`/api/r2/`, VendorOrderRow hydration |
| T4 | Onboarding + settings | personal/career/lifestyle fully i18n'd (career + lifestyle were zero), settings completion |
| T5 | Requests + hydration | RequestsClient (886 lines) fully i18n'd + StatusChip; RevenueSparkline/ChatHeader/TaskKanban mounted guards |

## Wave 2 (2 teammates)

- T6: weddings seating/moodboard/registry/InviteBuilder i18n (website page was already done).
- T7: spillover — store orders + StatusBanner + VendorOrderRow actually wired to next-intl, ProductGrid no-products EmptyState.

~680 en+hi keys merged across 8 fragments (`premium-ui-{admin2,payments,bookings,store,settings,requests,weddings2}`).

## Hindi visual pass (375px)

Walked admin, requests, payments, bookings, settings, onboarding career, weddings seating,
store orders, chats in `hi`. All Devanagari, consoles clean, no MISSING_MESSAGE.
Fixed: admin hub horizontal overflow (grid items needed `min-w-0` so the KYC table scrolls in
its own wrapper — pre-existing, both locales) and one transliterated string (`असीट` → `बिना सीट`).

## CI — first fully green pipeline

Every historical PR run of CI had failed. Root causes found and fixed this session:

1. `demoTraffic.test.ts` DB signal checks verify a demo-seeded DB — now opt-in via `DEMO_DB_CHECKS=1`.
2. promptfoo 0.107.7 crashes on fresh installs (async `Eval.create` transaction vs newer drizzle-orm);
   pinned 0.121.19 + split configs (`promptfooconfig.ml.yaml` / `.llm.yaml`) since `--filter-providers`
   hard-errors there. ML evals: 7/7.
3. `vitest.setup.ts` hardcoded `DATABASE_URL` over CI's injected URL (SASL password error in every DB suite) — now `??=`.
4. CI never applied hand-written migrations 0030–0039 (drizzle journal ends at 0029) — psql step added.
5. Mobile jest 5s default timeout vs 2-core runner CPU starvation — 15s.
6. `timezone.ts` `hour12:false` resolves to h24 on some ICUs → midnight "24:00" reparses as next day
   (offsets 1440 min off). Production bug; fixed with `hourCycle: 'h23'`.
7. guna suite env-pinned (`shouldUseMockMongo` mocked false — CI has no root `.env`).
8. E2E job had never executed: `pnpm exec playwright` can't see apps/web's binary from the root,
   and without `VERCEL_PREVIEW_URL` it targets localhost. Filtered to web + warn-first skip.

## Orchestrator catches (why agent output is re-verified)

Smart quotes (`‘’`) in t() calls breaking the parser (T5), `t`/`table` variable shadowing (T6),
unused imports + destructuring bug (T1/T2), orphan duplicate `PaymentLinksClient` in
components/payments (T2), i18n wiring claimed but not done (T3 — finished by T7).

## Remaining backlog (unchanged from phase-3 docs)

Phase-4 UX candidates: checkout sticky order summary, chat photo-upload spinner, voice-player
error state, emoji keyboard nav, typing animation, store filter lazy-load, marketplace analytics.
Never-audited: family/parent-mode, support, coordinator, notifications, b2b, assistant, calendar.
Minor: seating "seats" literal next to interpolation.
