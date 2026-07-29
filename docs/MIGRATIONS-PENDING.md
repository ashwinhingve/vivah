# Migrations pending — apply via Railway SQL console

> **Protocol:** per `CLAUDE.md` "Production DB Migration Protocol", we do
> **NOT** run `drizzle-kit push` against the production proxy from WSL.
> The block below is hand-vetted SQL to apply via the Railway dashboard
> SQL console **before** the next API deploy lands. After application,
> drizzle-kit reconciliation can be a no-op.

## P1-8 — Vendor approval workflow (Sprint Path B, commit `aed23df`)

> **✅ APPLIED 2026-05-20 ~15:11 UTC** via `psql` from WSL2 (Railway proxy
> reachable from this dev box — prior `ETIMEDOUT` blocker no longer
> reproduces). All verify queries returned the expected shape; vendor row
> count was 0 at apply time so the defensive `UPDATE` was a no-op.
> See "Applied migrations" log at bottom of this file for the verified
> post-state snapshot.

### Pre-flight

1. **Backup**: Railway → Postgres → Data → Backups → "Create backup now".
2. Confirm current state: `SELECT COUNT(*) FROM vendors;` — record the
   number; you should see the same after the `UPDATE vendors SET status =
   'APPROVED'` defensive backfill.
3. Confirm `audit_event_type` enum currently has `'VENDOR_APPROVED'` but
   none of the new five values — see schema in
   `packages/db/schema/index.ts:305`.

### Apply (all additive — no DROP, no TRUNCATE)

```sql
-- ─── New enums ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE vendor_status AS ENUM (
    'DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rejection_category AS ENUM (
    'INCOMPLETE_DOCS', 'POLICY_VIOLATION', 'IDENTITY_CONCERN', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── New columns on vendors ──────────────────────────────────────────────
-- status default APPROVED keeps existing public listings intact.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS status               vendor_status NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS submitted_at         timestamp,
  ADD COLUMN IF NOT EXISTS reviewed_at          timestamp,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id  text REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS rejection_reason     text,
  ADD COLUMN IF NOT EXISTS rejection_category   rejection_category;

-- ─── Defensive backfill (column default does this — pinned for ops) ─────
UPDATE vendors SET status = 'APPROVED' WHERE status IS NULL;

-- ─── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS vendor_status_idx
  ON vendors USING btree (status);

CREATE INDEX IF NOT EXISTS vendors_status_submitted_idx
  ON vendors USING btree (status, submitted_at);

-- ─── Extend audit_event_type enum (one ADD VALUE per statement) ─────────
-- Postgres requires each ADD VALUE in its own transaction; run sequentially.
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VENDOR_SUBMITTED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VENDOR_UNDER_REVIEW';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VENDOR_REJECTED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VENDOR_SUSPENDED';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'VENDOR_REINSTATED';
```

### Verify

```sql
-- Status distribution — should be all 'APPROVED' immediately after backfill.
SELECT status, COUNT(*) FROM vendors GROUP BY status;

-- Enum values — should include the 6 new vendor_status + extended audit.
SELECT enumlabel FROM pg_enum
  WHERE enumtypid = 'vendor_status'::regtype ORDER BY enumsortorder;

SELECT enumlabel FROM pg_enum
  WHERE enumtypid = 'audit_event_type'::regtype
    AND enumlabel LIKE 'VENDOR_%'
  ORDER BY enumsortorder;

-- Index sanity
SELECT indexname FROM pg_indexes
  WHERE tablename = 'vendors' AND indexname LIKE '%status%';
```

### Then deploy the API

Once SQL above is applied successfully:

- Push the API image (Railway picks up `main` automatically) — the deploy
  pipeline already includes the schema package's TypeScript types, so the
  new columns are available at the application layer.
- After deploy, `GET /api/v1/vendors` returns only `status='APPROVED'`
  rows (existing rows backfilled, so no visible change). New vendor
  signups will land in `DRAFT` and stay hidden until they self-submit and
  an admin approves via `/admin/vendors/queue`.

### Rollback (only if something is irrecoverably wrong)

The migration is additive, so the safest "rollback" is to leave the
columns/indexes in place and revert the deploy. The columns are not
exercised by old code so they're harmless inert. **Do NOT** drop the
enums — they may be referenced by audit log rows once any vendor
transition has fired.

---

## Future migrations

When a future PR needs DB changes, append a new section here following
the same format: pre-flight, additive SQL block, verify queries, deploy
order, rollback notes. Keep this file flat so ops can grep for any
unresolved schema work.

---

## Applied migrations log

### 2026-05-20 ~15:11 UTC — P1-8 vendor approval workflow

- **Applier:** Claude Code session (WSL2 → Railway proxy reachable; older
  `ETIMEDOUT` blocker documented in `CLAUDE.md` no longer reproduces).
- **Method:** `psql` heredoc, single connection, `ON_ERROR_STOP=1`.
- **Pre-state:** `vendors` row count = 0 (fresh prod, no backfill risk).
- **Post-state (verified):**
  - `vendor_status` enum: `DRAFT, PENDING, UNDER_REVIEW, APPROVED, REJECTED, SUSPENDED` (6 values)
  - `rejection_category` enum: `INCOMPLETE_DOCS, POLICY_VIOLATION, IDENTITY_CONCERN, OTHER` (4 values)
  - `audit_event_type` extended with 5 new VENDOR_* values (6 total)
  - `vendors` table gained 6 columns: `status NOT NULL DEFAULT 'APPROVED'`, `submitted_at`, `reviewed_at`, `reviewed_by_user_id` (FK → `user(id)`), `rejection_reason`, `rejection_category`
  - Indexes present: `vendor_status_idx`, `vendors_status_submitted_idx`
- **Follow-ups:**
  - Rotate `DATABASE_URL` password — it was pasted into this session's
    chat scrollback. Update Railway env, Vercel env, local `.env`.
  - Next API deploy will exercise the new columns; old code is harmless
    on the additive schema until then.

### 2026-05-21 ~12:35 UTC — 0025 LGBTQ+ support + platform_settings

- **Applier:** Ashwin (manual psql against Railway proxy from WSL2).
- **Method:** `psql` with `ON_ERROR_STOP=1`. Migration file:
  `packages/db/migrations/0025_lgbtq_support.sql`.
- **Pre-state:** `gender` enum had 3 values (`MALE, FEMALE, OTHER`);
  `platform_settings` table did not exist; `audit_event_type` lacked
  `PLATFORM_SETTING_CHANGED`.
- **Post-state (verified):**
  - `gender` enum: `MALE, FEMALE, NON_BINARY, OTHER` (4 values)
  - `audit_event_type` extended with `PLATFORM_SETTING_CHANGED`
  - `platform_settings` table created with PK on `key`, FK
    `updated_by → user(id)`
  - Seed row present: `lgbtq_matching_enabled = false`
- **Follow-ups:**
  - Admin toggle UI at `/admin/settings` now writes succeed.
  - Engine reads the flag via `platformSettingsService`; defensive
    try/catch keeps behavior at "flag OFF" if the read ever fails.

---

---

## ✅ APPLIED 2026-06-01 (UTC) — migrations 0026 + 0027 to PRODUCTION

Supervised prod op (Tier 1). Applied via `psql` from WSL2 against the Railway
proxy (`shortline.proxy.rlwy.net`, server **PostgreSQL 18.3**), autocommit
(no `--single-transaction`, so `ALTER TYPE … ADD VALUE` is safe).

**Backup:** Railway dashboard → "Create backup now" snapshot taken immediately
before apply. (Local `pg_dump` unavailable — client 16.14 vs server 18.3 major
mismatch; Railway snapshot is the point-in-time backup.)

**Dry-run:** fresh scratch DB built from migrations `0000–0025`, then `0026` +
`0027` applied with zero errors; `0026` re-run confirmed idempotent.

**Pre-flight (prod, read-only):** `wedding_invites` absent, `invite_status`
absent → `0027` clean first apply; all `0026` objects already present (vendor
approval enums/columns, `weddings.deleted_at`) → `0026` a confirmed **no-op**
(every statement reported `already exists, skipping`). `vendor_count = 0`.

**Verify (prod):**
- `\d wedding_invites` → 12 columns; PK `wedding_invites_pkey`; uniques
  `wedding_id_unique`, `slug_unique`; index `slug_idx`; FK
  `wedding_id → weddings(id) ON DELETE CASCADE`.
- `invite_status` enum = `{DRAFT, PUBLISHED}`.
- `0026` spot-checks: `vendors.status` present; `ceremony_type` has
  `TILAK,SAGAN`; `audit_event_type` has the 5 `VENDOR_*` values;
  `ceremonies.custom_type_name` + `weddings.deleted_at` present.

**Scope:** ONLY `0026` + `0027` applied. No `__drizzle_migrations`
reconciliation, no `db:push`, no destructive ALTERs.

> 🔐 **Security:** the prod `DATABASE_URL` was exposed in a chat transcript during
> this op — **rotate the Railway Postgres password** (Railway env + Vercel env +
> local `.env`) as a follow-up.

---

## ✅ DRIFT RECONCILED 2026-06-07 (was: migration tracking out of sync with prod)

> **RESOLVED** via `scripts/db/reconcile-drift-2026-06-07.sql` (psql from WSL2 against
> the Railway proxy, additive + idempotent, verified). Rollback: `scripts/db/rollback-drift-2026-06-07.sql`.
> The original drift write-up is kept below for history. **Live finding during the
> reconcile:** `drizzle.__drizzle_migrations` did not exist on prod *at all* (prod was
> built by `db:push`/console, never `drizzle migrate`) — and only `CREATE EXTENSION vector`
> of 0029 had been applied, **not** the `profiles.ai_embedding` / `embedding_updated_at`
> columns or the HNSW index. The reconcile created the tracking table, baseline-seeded all
> **30** migrations (0000–0029) with real `sha256(file)` hashes + journal `when` millis, and
> finished 0029's missing columns+index. Post-state: 30 rows, high-water `1780735487081`,
> both embedding columns present, no duplicate hashes, re-run is a no-op. A future
> `drizzle migrate` now applies only 0030+.

Two prod schema changes were applied **outside** `drizzle-kit migrate`, so they were
**not recorded in `__drizzle_migrations`**. Prod and the migration journal had
drifted (do NOT `drizzle-kit push` against prod — PK 42P16 hazard per CLAUDE.md).

1. **`0028` (calendar_events) — console-applied, not journaled.**
   The `calendar_event_kind` + `auspicious_band` enums and the `calendar_events`
   table (migration file `0028_sturdy_next_avengers.sql`) were applied via the
   Railway SQL console, not through `drizzle-kit migrate`. The `.sql` file exists
   in `packages/db/migrations/` but `__drizzle_migrations` has no row for it.

2. **`CREATE EXTENSION vector` — run directly, no migration file.**
   pgvector was enabled with a direct `CREATE EXTENSION` against prod. There is no
   migration file for it and no `__drizzle_migrations` entry. (Note: per CLAUDE.md,
   `0029_pgvector_embedding.sql` must only be applied after confirming
   `pg_available_extensions` lists `vector` — that confirmation/enable happened
   out-of-band.)

**Consequence:** a fresh `drizzle-kit migrate` against prod would try to re-apply
`0028` (the file is idempotent — `IF NOT EXISTS` guards — so it's a safe no-op, but
the journal still won't match). The migration journal is **not** a reliable record
of prod state for these two items.

**Reconcile (DONE 2026-06-07):** chose option (a) — baseline-seed `__drizzle_migrations`
to match the journal — but extended to all 30 migrations since the table was entirely
absent, and additionally finished the partially-applied 0029. See the RESOLVED banner at
the top of this section and `scripts/db/reconcile-drift-2026-06-07.sql`.

**Seeded data (not a migration):** `calendar_events` was data-seeded on
2026-06-07 (190 rows: MUHURAT 152 / FESTIVAL 32 / GOVT 6) via `db:seed:calendar`
from PowerShell — idempotent (run 1 = 190 inserted, run 2 = 0). Data only, no DDL.

---

## Migrations 0030–0041 (hand-authored, post-0029 freeze)

> **⚠️ SCHEMA FROZEN AT 0040** — operator directive 2026-07-26. Migration 0041 is
> enum-only (forward-only, cannot rollback per Postgres semantics).
>
> **✅ APPLY-STATE VERIFIED ON PROD 2026-07-29** (psql from WSL against Railway,
> PG 18.3). Every object from `0030–0041` was already present live — pgvector +
> `vector(768)` + HNSW index, all tables/indexes/columns, and the three 0041 enum
> values. Files `0031–0041` were re-run with `ON_ERROR_STOP=1` as an idempotence
> check: all no-oped except 0038's guarded `vendors.city_id` backfill, which
> linked 12 vendors that were still NULL (designed behaviour; pre-state snapshot
> + `rollback-0038-vendors-backfill.sql` kept in `~/prod-snapshots-2026-07-29/`).
> 0030 was not re-run (fully applied; a re-run would only churn the HNSW index).
> The prod `__drizzle_migrations` ledger was then seeded through `0041` via
> `scripts/db/reconcile-ledger-0030-0041-2026-07-29.sql` → **42 rows, high-water
> 0041** (local dev DB seeded identically). File-side meta (journal + snapshots)
> still stops at 0029 — see `docs/db/journal-drift.md` before any
> `drizzle-kit generate`.
>
> All **0030–0040 are additive + idempotent**. **0041 is forward-only** (adds enum
> values; Postgres does not support dropping enum values).

### 0030 — pgvector embedding resize (768-dim)

- **Source:** `packages/db/migrations/0030_pgvector_embedding_768.sql`.
- **Scope:** Resize `profiles.ai_embedding` from `vector(1536)` → `vector(768)`;
  drop + recreate HNSW index (no data loss — all existing values NULL).
- **Status:** Additive + idempotent.
- **Note:** Hand-authored to match 0029 convention. See `docs/db/journal-drift.md`
  for full context (0030/0031 bypass the drizzle journal).

### 0031 — Support Tickets console

- **Source:** `packages/db/migrations/0031_support_tickets.sql`.
- **Scope:** 5 enums (`ticket_category`, `ticket_priority`, `ticket_status`,
  `ticket_source`, `ticket_event_type`) + 3 tables (`support_tickets`,
  `ticket_messages`, `ticket_events`).
- **Status:** Additive + idempotent.
- **Note:** Hand-authored; untracked in drizzle journal (see `journal-drift.md`).

### 0032 — Financial shells & WhatsApp messages

- **Source:** `packages/db/migrations/0032_financial_shells.sql`.
- **Scope:** Phase 6 Sprint D — 4 enums (`service_referral_kind`,
  `service_referral_status`, `whatsapp_message_status`, `money_currency`) +
  `service_referrals` + `whatsapp_messages` tables (RBI LSP compliance).
- **Status:** Additive + idempotent.

### 0033 — Virtual dates & retention campaigns

- **Source:** `packages/db/migrations/0033_virtual_dates_retention.sql`.
- **Scope:** Phase 7 Sprint F — 3 enums + `virtual_dates` + `retention_campaigns`
  tables. Durable layer for video-date history and churn-recovery tracking.
- **Status:** Additive + idempotent.

### 0034 — NRI / international matching

- **Source:** `packages/db/migrations/0034_nri_international.sql`.
- **Scope:** Phase 7 Sprint G — `residency_status` enum + NRI columns on
  `profiles` (country, timezone, residency, NRI opt-in). Gated behind
  `NRI_MATCHING_LIVE` flag; existing rows safe (nullable/default).
- **Status:** Additive + idempotent.

### 0035 — Analytics indexes (scale hardening)

- **Source:** `packages/db/migrations/0035_scale_indexes.sql`.
- **Scope:** Phase 8 Sprint H — 3 composite btree indexes on `payments`
  (`status`, `created_at`) and `bookings` (`vendor_id`, `event_date`, `status`,
  `profile_id`, `start_at`). No DROP / ALTER COLUMN.
- **Status:** Additive + idempotent (index-only, zero data risk).

### 0036 — Destination wedding planning core

- **Source:** `packages/db/migrations/0036_destination_wedding.sql`.
- **Scope:** Phase 8 Sprint I — `wedding_destinations` + `guest_travel_legs`
  tables. Multi-city wedding legs with country/timezone. Supply side (packages,
  rooms, transport) explicitly deferred.
- **Status:** Additive + idempotent.

### 0037 — Phase 8 supply: packages & post-marriage services

- **Source:** `packages/db/migrations/0037_phase8_supply_services.sql`.
- **Scope:** Phase 8 Units 8.1 + 8.2 — `premium_packages` (+
  `_inclusions`, `_availability`), `service_partners`, `post_marriage_*` tables,
  `vendor_inquiries`. Seeded placeholder inventory (role-gated until real partners).
  Money in rupees (decimal), not paise.
- **Status:** Additive + idempotent.

### 0038 — Marketing campaigns & city registry

- **Source:** `packages/db/migrations/0038_marketing_cities_registry.sql`.
- **Scope:** Phase 6 Unit 6.4 + 6.5 — `marketing_campaigns` (lifecycle DRAFT →
  APPROVED → ACTIVE), `campaign_content`, `campaign_sends` (with idempotency
  PARTIAL index). Registry `cities` seeded with 10 operational markets (Tier 1).
- **Status:** Additive + idempotent.

### 0039 — Supply city registry link

- **Source:** `packages/db/migrations/0039_supply_city_registry_link.sql`.
- **Scope:** Phase 8 — Add nullable `city_id` FKs on `premium_packages` and
  `service_partners` to bind supply to the admin city registry (0038 pattern).
  Free-text city column stays for display/SEO; `city_id` is canonical for facets.
- **Status:** Additive + idempotent.

### 0040 — Referral credits ledger

- **Source:** `packages/db/migrations/0040_referral_credits_ledger.sql`.
- **Scope:** Phase 4 — Append-only ledger for atomic credit reservations +
  double-spend prevention. 3 indexes on `user_id`, `type`, `created_at`.
- **Status:** Additive + idempotent.

### 0041 — Audit event types (P2-4 safety + virtual-date lifecycle)

- **Source:** `packages/db/migrations/0041_audit_event_types_p2_4.sql`.
- **Scope:** Adds 3 enum values to `audit_event_type`:
  `PROFILE_UNBLOCKED`, `VIRTUAL_DATE_EXPIRED`, `VIRTUAL_DATE_NO_SHOW`.
  Enables truthful audit trail for unblock + virtual-date lifecycle sweep.
- **Status:** **Forward-only** (Postgres cannot DROP enum values). Each `ALTER
  TYPE … ADD VALUE` is a separate statement (not transactional); apply via
  Railway SQL console or `psql` standalone.
- **Rollback:** Not possible. Treat as permanent schema change.
