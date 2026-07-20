# ✅ Production subscription pricing — corrected

> **Found:** 2026-07-19 · **Fixed:** 2026-07-20 · **Status:** APPLIED AND VERIFIED
> **Was:** launch-blocking. No longer blocks launch.

## Outcome

Applied `packages/db/migrations/sync-plans-to-source-of-truth.sql` against
production. Production now holds all six plans at the intended prices:

| Plan | Before | After |
|---|---|---|
| `STANDARD_M` | ₹999 | **₹499** |
| `STANDARD_Q` | *did not exist* | **₹1,199** |
| `STANDARD_Y` | ₹8,999 | **₹3,999** |
| `PREMIUM_M` | ₹2,499 | **₹999** |
| `PREMIUM_Q` | *did not exist* | **₹2,499** |
| `PREMIUM_Y` | ₹22,999 | **₹7,999** |

Verified after the write: `plans = 6`, `subscriptions = 5` (unchanged),
`subscription_charges = 0`, `payments = 0`, and **no plan lost its
`razorpay_plan_id`** — that column was deliberately excluded from the updates
because it is provisioned per environment.

### How it was applied safely

1. Blast radius confirmed BEFORE writing: 0 charges, 0 payments — no money had
   ever moved through this table.
2. Snapshot taken: `/tmp/prodbackup/plans-before-repricing.csv` (4 rows).
3. **Dry run first** — the identical statements executed inside a transaction
   with `COMMIT` rewritten to `ROLLBACK`. All ten statements succeeded with the
   expected row counts, and a `SELECT` afterwards confirmed production was
   untouched.
4. Then applied for real in a single transaction.

Rollback, if ever needed: `packages/db/migrations/rollback-plans-reprice.sql`
holds the exact prior values.

---

## Original report (retained for the record)

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

## How it was fixed

Applied as plain SQL via `psql` rather than the tsx runner originally proposed —
`packages/db/migrations/sync-plans-to-source-of-truth.sql`. Plain SQL is
auditable after the fact, is idempotent (absolute values, `ON CONFLICT (code)`),
and sidesteps the WSL→Railway node connectivity issue entirely, since `psql`
reaches the proxy directly.

The temporary `seed/_plans-sync.ts` runner has been deleted; the migration file
is now the record of what ran.

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
