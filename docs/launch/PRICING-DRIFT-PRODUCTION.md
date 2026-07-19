# 🔴 Production is charging the wrong subscription prices

> **Found:** 2026-07-19 · **Status:** NOT FIXED — needs one command from Ashwin
> **Severity:** launch-blocking. Do not open payments until this is applied.

## What is wrong

Commit `3eccd00` ("reprice below market, add quarterly, single source of truth")
changed `packages/types/src/plans.ts`. That change **never reached the database**.
Production's `plans` table still holds the pre-repricing numbers, and the two
quarterly plans do not exist at all.

| Plan | Production today | Source of truth | Overcharge |
|---|---|---|---|
| `STANDARD_M` | ₹999 | ₹499 | 2.0× |
| `STANDARD_Y` | ₹8,999 | ₹3,999 | 2.25× |
| `PREMIUM_M` | ₹2,499 | ₹999 | 2.5× |
| `PREMIUM_Y` | ₹22,999 | ₹7,999 | **2.9×** |
| `STANDARD_Q` | *missing* | ₹1,199 | — |
| `PREMIUM_Q` | *missing* | ₹2,499 | — |

The billing page renders whatever is in the table, so the first real customer
would be quoted ₹22,999 for a plan the business decided to sell at ₹7,999.

## Why it happened

`seedPlans()` in `packages/db/seed/full-demo.ts` used `onConflictDoNothing()`.
A price change reached **new** environments (no row yet → insert) but never
**existing** ones (row present → insert silently discarded). Local dev looked
correct on a fresh database, which is why it went unnoticed.

**Root cause is fixed** in this commit: the seed now uses `onConflictDoUpdate`
keyed on `code`, so plans converge to the source of truth every run.
`razorpay_plan_id` is deliberately excluded from the update set — it is
provisioned per environment and re-seeding must not clear it.

## Blast radius (checked, not assumed)

- `subscriptions` = 5 (demo rows)
- `subscription_charges` = **0**
- `payments` = **0**

No money has ever moved, and `USE_MOCK_SERVICES=true` means Razorpay cannot
charge. Correcting the table now is free. Correcting it after go-live is not.

## The fix — one command

I could not apply this myself: writing production pricing was blocked by a
permission guard, which is the correct behaviour for an unattended session.
Run it yourself:

```bash
cd ~/vivahOS/packages/db

# WSL note: node cannot reach the Railway proxy over its NAT64 IPv6 path even
# though psql can, so substitute the resolved IPv4 into the URL.
#   getent ahostsv4 shortline.proxy.rlwy.net   -> 66.33.22.244
DATABASE_URL='<PRODUCTION_DB with host replaced by 66.33.22.244>' \
  npx tsx seed/_plans-sync.ts
```

`seed/_plans-sync.ts` calls **only** `seedPlansOnly()`. It does not call
`seedFullDemo()`, which would create demo users, profiles, matches and chats in
production. Delete `seed/_plans-sync.ts` after use.

Verified on the local database first: 4 rows updated, 2 quarterly plans
inserted, final state matches `packages/types/src/plans.ts` exactly.

## Verify afterwards

```sql
SELECT code, interval, amount, active FROM plans ORDER BY code;
```

Expect 6 rows: 499 / 1199 / 3999 (Standard M/Q/Y) and 999 / 2499 / 7999
(Premium M/Q/Y).

Then reload `/settings/billing` and confirm six plans render with the new
prices.

## Rollback

Pre-change snapshot: `/tmp/prodbackup/plans-before.csv` (captured live).
Rollback SQL with the exact prior values:
`packages/db/migrations/rollback-plans-reprice.sql`.

## The wider lesson

This is the second instance today of the same failure mode: **code shipped, data
did not**. The first was five migrations that never reached production, so
merged features had no tables. Both were invisible to type-check, build and
1,300 unit tests, because all of those run against code, not against production
state.

Worth adding to the release checklist: after any change to reference data
(plans, cities, categories, feature flags), assert the production row actually
matches the committed constant.
