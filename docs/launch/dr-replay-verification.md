# DR Migration-Replay Verification

> **Date:** 2026-05-31 · **Branch:** `feat/45-migration-rollup`
> **Goal:** prove a fresh database built from `packages/db/migrations/` alone
> reproduces production, and make the Drizzle migration history canonical again
> after a period of out-of-band (`db:push` + ad-hoc SQL) production patching.

---

## TL;DR

- A fresh DB built by `drizzle-kit migrate` (migrations `0000` → `0026`) now
  reproduces the schema source-of-truth **exactly** for the eight audited
  tables, and **functionally** for the entire schema (every column, enum,
  index, and constraint definition matches).
- Two distinct problems were found and fixed:
  1. **Snapshot meta was broken** — `meta/0020_snapshot.json` was malformed and
     `0021`–`0025` snapshots were missing, so `drizzle-kit generate` errored.
     Regenerated `0020`–`0026` snapshots; `generate` is clean again.
  2. **The migration SQL chain was incomplete** — several objects had been
     applied to prod via `db:push` / the Railway SQL console but never written
     as migrations. Captured them in a new idempotent rollup
     `0026_drift_rollup.sql`.
- The original 2026-05-08 `fix-schema-drift.sql` concern is **already resolved**:
  those columns were folded into migrations `0006`–`0009` before the
  2026-05-11 audit. See `docs/audits/schema-audit-2026-05-11.md`.

---

## Background

Production has historically been kept in sync via `drizzle-kit push` and
hand-vetted SQL applied through the Railway console (see
`docs/MIGRATIONS-PENDING.md`), rather than the
`generate → commit → migrate` flow. This left the migration files unable to
rebuild prod from scratch — a disaster-recovery (DR) gap.

This document records the verification that the gap is now closed.

## What was wrong

### 1. Broken snapshot meta (blocked `drizzle-kit generate`)

`migrations/meta/_journal.json` listed 26 migrations (idx `0000`–`0025`) but
`meta/` contained valid snapshots only through `0019`. `0020_snapshot.json` was
malformed (rejected by drizzle-kit `0.29.1`) and `0021`–`0025` were absent.
`drizzle-kit generate` aborted with `migrations/meta/0020_snapshot.json data is
malformed`. (`drizzle-kit migrate` was unaffected — it replays the `.sql` files
by journal order and ignores snapshots.)

### 2. Incomplete migration SQL chain (blocked DR replay)

A fresh `migrate 0000→0025` produced a schema **missing** the following objects,
which exist in the schema source-of-truth (`packages/db/schema/`) and in prod
because they were applied out-of-band:

| Kind | Object | Origin |
|------|--------|--------|
| enum type | `vendor_status` | vendor approval (P1-8), prod via Railway console 2026-05-20 |
| enum type | `rejection_category` | vendor approval (P1-8) |
| `audit_event_type` values | `VENDOR_SUBMITTED`, `VENDOR_UNDER_REVIEW`, `VENDOR_REJECTED`, `VENDOR_SUSPENDED`, `VENDOR_REINSTATED` | vendor approval (P1-8) |
| `vendors` columns | `status`, `submitted_at`, `reviewed_at`, `reviewed_by_user_id`, `rejection_reason`, `rejection_category` | vendor approval (P1-8) |
| `vendors` indexes | `vendor_status_idx`, `vendors_status_submitted_idx` | vendor approval (P1-8) |
| `ceremony_type` values | `TILAK`, `SAGAN` | `db:push` |
| `ceremonies` column | `custom_type_name` | `db:push` |
| `weddings` column | `deleted_at` (soft-delete) | `db:push` |

## The fix

- **`0026_drift_rollup.sql`** — a new, fully idempotent migration
  (`CREATE TYPE … EXCEPTION duplicate_object`, `ADD VALUE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, guarded FK) that
  creates every object in the table above. It is a safe no-op on production
  (which already carries them all).
- **Regenerated snapshots `0020`–`0026`** — `0020`–`0025` were reconstructed by
  replaying `drizzle-kit generate` against each migration's commit
  (`git checkout <commit> -- packages/db/schema`), preserving the `prevId`
  chain; `0026` chains off `0025`. The hand-written `.sql` files were left
  untouched. `_journal.json` gained only the `0026` entry.

> **Note (snapshot vs SQL ordering):** because prod's history is non-linear,
> the regenerated snapshots `0021`–`0025` reflect schema-source state that
> already includes the drift objects, while the `.sql` chain only creates them
> in `0026`. drizzle never cross-validates the two, so this is cosmetic — it
> affects neither `generate` (clean) nor `migrate` (reproduces prod).

## Verification procedure (reproducible)

Run from a shell with PostgreSQL 16 available. A scratch cluster was used on
`127.0.0.1:5433`; substitute your own.

```bash
# 1. Two scratch databases on the same cluster
psql -p 5433 -U postgres -c "CREATE DATABASE smartshaadi_replay;"   # built by migrate
psql -p 5433 -U postgres -c "CREATE DATABASE smartshaadi_push;"     # built from schema TS

# 2. Build the "migrate" DB from migration files (0000 → 0026)
DATABASE_URL=postgres://postgres@127.0.0.1:5433/smartshaadi_replay \
  pnpm --filter @smartshaadi/db db:migrate

# 3. Build the reference DB directly from the schema source-of-truth
DATABASE_URL=postgres://postgres@127.0.0.1:5433/smartshaadi_push \
  pnpm --filter @smartshaadi/db db:push --force

# 4. Diff catalogs (columns / enums / indexes / constraint definitions)
#    — see the queries below.
```

The reference DB is built with `db:push` of `packages/db/schema/` — this is
exactly how production was provisioned, so it is a faithful prod stand-in. A
direct production dump was **not** run here (this box's root `.env` points at
local Postgres, not prod). To confirm against the live database, run from a
Railway-reachable shell (never paste the prod URL into chat/commits/logs):

```bash
pg_dump --schema-only --no-owner \
  -t profiles -t kyc_verifications -t vendors -t match_requests \
  -t guests -t ceremonies -t invitations -t notification_preferences \
  "$PROD_DATABASE_URL" > prod_8tables.sql
# then diff against the same dump of smartshaadi_replay (post-0026)
```

## Results

### Migrate applied cleanly

`drizzle-kit migrate` applied all 27 migrations (`0000`–`0026`); 105 tables
created; `drizzle.__drizzle_migrations` rows = 27.

### Eight audited tables — exact match

Column set + type + nullability + default, `migrate(0000→0026)` vs `push(schema TS)`:

| Table | Columns | Match |
|-------|--------:|:-----:|
| `profiles` | 19 | EXACT ✓ |
| `kyc_verifications` | 50 | EXACT ✓ |
| `vendors` | 36 | EXACT ✓ |
| `match_requests` | 13 | EXACT ✓ |
| `guests` | 23 | EXACT ✓ |
| `ceremonies` | 18 | EXACT ✓ |
| `invitations` | 9 | EXACT ✓ |
| `notification_preferences` | 9 | EXACT ✓ |

### Whole-schema functional diff — clean

- **Columns** (all 105 tables): no differences.
- **Enums + values**: no differences.
- **Indexes**: identical, except the `referral_codes` unique-on-`code`
  constraint name (see cosmetic note).
- **Constraints** (name-agnostic, by definition): **320 = 320, zero
  differences** — every FK / unique / PK / check exists identically in both.

### Canonical `generate`

```
$ pnpm --filter @smartshaadi/db db:generate
No schema changes, nothing to migrate 😴
```

The snapshot `prevId` chain `0019 → 0020 → … → 0026` is intact.

## Known cosmetic (non-functional) residue

Constraint and index **names** differ between a `migrate`-built DB and a
`push`-built/prod DB on the hand-authored migrations (`0021`–`0024`):

| Migrate (`.sql`, Postgres-default) | Push / prod (drizzle) |
|------------------------------------|-----------------------|
| `referral_codes_code_key` | `referral_codes_code_unique` |
| `<table>_<col>_fkey` | `<table>_<col>_<reftable>_<refcol>_fk` |

Referential integrity and indexing are identical; only the identifiers differ.
These are **not** reconciled here: renaming constraints on production is
invasive and offers no functional benefit. New migrations should be produced
with `drizzle-kit generate` so future names match the drizzle convention.

## Verification queries

```sql
-- columns
SELECT table_name||'.'||column_name FROM information_schema.columns
WHERE table_schema='public' ORDER BY 1;
-- enum values
SELECT t.typname||':'||e.enumlabel FROM pg_enum e
JOIN pg_type t ON e.enumtypid=t.oid ORDER BY 1;
-- indexes
SELECT tablename||'.'||indexname FROM pg_indexes
WHERE schemaname='public' ORDER BY 1;
-- constraints (name-agnostic)
SELECT conrelid::regclass::text||' | '||contype::text||' | '||pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1;
```

Diff each catalog between the two DBs with `comm -13` / `comm -23` on sorted output.
