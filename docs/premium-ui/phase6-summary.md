# Premium UI — Phase 6 Session Record (2026-07-21/22)

Cleared the documented phase-5 follow-up backlog: every remaining straggler route
audited and brought up to the premium-UI bar (full next-intl i18n, StatusChip,
EmptyState overrides, locale-aware date/number formatting, design tokens). Executed
with 5 Opus teammates in a single wave under strict file-ownership partitioning
(no worktrees), i18n via per-agent fragment files merged by the orchestrator.

## Shipped

### Orchestrator-owned fixes
- `services/insurance/InsuranceClient` + `services/lending/LendingClient`: `formatINR`
  now takes a locale tag from `useLocale()` (hi→hi-IN) instead of hardcoded 'en-IN';
  `'Something went wrong'` fallbacks → `common.error`.
- `servicesLending.tenureMonths` key ("{months} mo" / "{months} माह") replacing the
  `{n} mo` literal; fixed pre-existing mistranslation "कार्यकाल" (term of office) →
  "अवधि" for Tenure.
- `vendor/onboarding/services/page.tsx`: 'en-IN' → getLocale mapping; raw `unit` enum
  → `vendorRole.onboarding.labels.serviceUnits.*` via literal-key Record.

### Teammate areas (5 fragments, 213 en+hi key pairs, all parity-checked)
- **T-A pricing + welcome** (`premium-ui-pricing`, 40 pairs): fallback plan
  names/features, interval labels, mostPopular badge, CTAs, footer + link label;
  welcome page fully i18n'd (was 100% hardcoded) incl. generateMetadata, greeting
  with {firstName}, 3 cards, CTA, launch tagline.
- **T-B likes/shortlist/viewers** (`premium-ui-engage`, 18 pairs): fallback names,
  Verified → StatusChip(success), Respond CTA, viewers timeAgo → stable descriptor
  + ICU keys; orchestrator added photoAlt keys + emptyTitle/emptyDescription
  overrides (shortlist + viewers had bare EmptyState variants → English in hi;
  viewers even used the `no-network` preset for an empty list).
- **T-C documents + profiles** (`premium-ui-docsprof`, 10 pairs): documents status
  badges → StatusChip + `statuses.*` labels; profiles joinedRelative → ICU plurals,
  fallbackName, memberSince with locale-aware month formatting.
- **T-D vendor dashboards** (`premium-ui-vendorpages`, 64 pairs): leads (stats,
  filters, status labels, StatusChip), payouts (namespace created from zero — 25
  keys incl. schedule explainer, StatusChip), insights (namespace from zero),
  reviews (ICU plural subtitle), pipeline; generateMetadata on all 5; all date and
  number formatting locale-mapped.
- **T-E vendor onboarding forms** (`premium-ui-vendoronboard`, 81 pairs): Business/
  Availability/Portfolio/AddService/SubmitReview client forms + label maps for 16
  categories, 13 event types, 6 service units; AvailabilityManager mounted guard +
  locale fix; PricingBreakdown locale fix.

### Orchestrator catches (teammate output that self-reported success but was wrong)
1. T-A used `t('heading', { defaultValue: ... })` — next-intl has no defaultValue;
   the key didn't exist, so the raw key would have rendered → `greetingDefault` key.
2. T-A probed fallback feature keys with try/catch around t() — next-intl does NOT
   throw on missing keys, it returns the key string, so "pricing.fallbackPlans.
   free.features.f4" would have rendered as a visible feature bullet → explicit
   per-plan literal-key map.
3. Template-literal t() keys (banned) in T-A (welcome cards), T-C (document
   statuses); rewritten as literal-key Records.
4. T-B hardcoded 'hi-IN' (not 'en-IN' — worse) in viewers' absolute-date branch →
   descriptor carries ISO, formatted at render with the active locale.
5. T-C shipped 3 TS errors (`count: number | undefined` into ICU values) and
   reported them as pre-existing; T-E echoed that. Fixed with a discriminated
   union for the joinedRelative descriptor.
6. T-D left both pipeline EmptyState titles hardcoded while reporting the page
   done → new `pipeline.*Title` keys.
7. T-A's Hindi footer truncated mid-sentence around the Billing link → restructured
   with `footerLinkLabel`; also fixed "गुणवत्ता बनाम मात्रा" (quality *versus*
   quantity), "जन्मपत्र" → "जन्म कुंडली", clunky launch tagline.

### Verification
- Fragment JSON parse + en/hi key-parity script: 5/5 OK (213 pairs) before merge;
  merge reported 0 collisions with existing values.
- Grep audits clean: smart quotes, template-literal t(), Metadata-from-react,
  bg-white/bg-gray/raw hex, raw HTML in messages, i18next `_other` keys.
- `pnpm exec turbo type-check --force` 11/11, lint 11/11, web production build green.
- Browser (Playwright, 375px): pricing en+hi, welcome hi, likes en, shortlist hi,
  viewers hi, documents hi, profile detail en+hi ("Member since July 2026" /
  "जुलाई 2026 के बाद से सदस्य"), vendor payouts hi, leads en, pipeline hi, vendor
  onboarding business form hi (category dropdown fully Hindi), services lending hi
  ("अवधि: 24 माह"). Zero raw keys, zero console errors (one benign LCP hint).
- Infra note: Docker Desktop + all 3 DB containers were down mid-session; restarted.
  Web dev server 500'd globally after the mass message merge (stale HMR) and the
  API held a stale Mongo connection (profile 500s) — both fixed by restart, neither
  a code issue.

## Remaining backlog — CLEARED in follow-up session (2026-07-22)

All four items were completed on `feat/premium-ui-followups`:

- ✅ `OnboardingStepper` fully i18n'd — async server component using
  `vendorRole.onboarding.stepper.*` (literal-key label map), Back reuses
  `common.back`; browser-verified en + hi ("6 में से चरण 2").
- ✅ Vendor dashboards browser-exercised with a real VENDOR session (qa-ven-01,
  seeded 3 leads / 3 payouts / 2 reviews in local dev DB). Three real bugs found
  and fixed that only data rows could reveal:
  1. Payouts stat cards showed `₹NaN` — web typed the summary as
     `pending`/`failed` (strings) but the API returns `pendingAmount`/
     `failedAmount` (numbers). Interface aligned to the API shape.
  2. Lead rows rendered the raw `eventType` enum (`WEDDING`, `MEHNDI`) — now
     mapped through `vendorRole.onboarding.labels.eventTypes.*` (added missing
     `TILAK`/`SAGAN` keys; fixed hi `ENGAGEMENT` "सगुन" → "सगाई"); plus
     hardcoded `'Anonymous'` fallback → `fallbackName` key.
  3. `VendorReviewReply` widget was 100% hardcoded English (Reply / placeholder /
     Post reply / Posting… / Cancel / error) — fully i18n'd.
- ✅ packages + post-marriage loading skeletons consolidated onto shared
  `RouteSkeleton` presets (`mediaGrid` / `iconGrid`), rendered with the warm
  `Skeleton` primitive.
- ✅ DB-seeded subscription plan names/features now localize in the web UI via
  `apps/web/src/lib/plan-i18n.ts` — plan `code` → `planCatalog.names.*`, exact
  seeded English feature literal → `planCatalog.features.*`, unknown values fall
  back to the DB string (future plans degrade to English, never raw keys).
  Applied on /pricing, /settings/billing and the confirm step; also i18n'd the
  billing page's stray literals (Subscribe, Premium badge, Test Mode, Confirm &
  Pay, interval labels) and locale-mapped its number formatting.

Verification: forced turbo type-check 11/11, lint 11/11, unit tests green
(web forced), web production build green, en/hi key parity for all new
namespaces, browser pass (Playwright, 375px) over leads/payouts/reviews
(en+hi, with data), onboarding stepper (en+hi), pricing/billing/confirm (hi),
packages + post-marriage. Zero console errors.

Debug note: a stale `sw.js` service worker (`static-v1` Cache Storage) served
old client chunks during verification — symptoms looked exactly like stale HMR
(persisted across dev-server restart AND `rm -rf .next`). Fix: unregister the
SW + clear CacheStorage in the test browser before trusting "code didn't
update" symptoms.
