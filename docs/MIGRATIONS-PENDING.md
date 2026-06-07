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

## 0027 — Digital Invitation Builder (contract Item 16) — PENDING

- **Source:** `packages/db/migrations/0027_invitation_builder.sql` (apply verbatim).
- **Scope:** fully additive — `invite_status` enum + `wedding_invites` table +
  `wedding_invites_slug_idx`. No DROP / TRUNCATE / ALTER COLUMN.
- **Ordering:** generated on the canonical chain; apply after `0026_drift_rollup`.
- **Verify:** `SELECT to_regclass('public.wedding_invites');`
- **Validated** 2026-05-31 against a scratch PG16 DB: 12 columns, enum
  `{DRAFT,PUBLISHED}`, indexes `pkey / wedding_id_unique / slug_unique / slug_idx`.

---

## 0027 — Digital Invitation Builder (contract Item 16) — PENDING

> Generated cleanly on the canonical chain (after the `0026_drift_rollup`
> rollup lands). Fully additive — one new enum, one new table, one index.
> No DROP / TRUNCATE / ALTER COLUMN. Safe to apply via Railway SQL console
> or `psql` with `ON_ERROR_STOP=1`. Source: `migrations/0027_invitation_builder.sql`.

### Apply (all additive)

```sql
CREATE TYPE "public"."invite_status" AS ENUM('DRAFT', 'PUBLISHED');

CREATE TABLE IF NOT EXISTS "wedding_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wedding_id" uuid NOT NULL,
	"slug" varchar(32) NOT NULL,
	"template_id" varchar(50) DEFAULT 'classic-royal' NOT NULL,
	"status" "invite_status" DEFAULT 'DRAFT' NOT NULL,
	"title" varchar(255),
	"message" text,
	"rsvp_enabled" boolean DEFAULT true NOT NULL,
	"asset_key" varchar(500),
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wedding_invites_wedding_id_unique" UNIQUE("wedding_id"),
	CONSTRAINT "wedding_invites_slug_unique" UNIQUE("slug")
);

DO $$ BEGIN
 ALTER TABLE "wedding_invites" ADD CONSTRAINT "wedding_invites_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "wedding_invites_slug_idx" ON "wedding_invites" USING btree ("slug");
```

### Verify

```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='invite_status';  -- DRAFT, PUBLISHED
SELECT to_regclass('public.wedding_invites');  -- wedding_invites
```

> Locally validated 2026-05-31 against a scratch PG16 DB: 12 columns,
> enum `{DRAFT,PUBLISHED}`, indexes `pkey / wedding_id_unique / slug_unique / slug_idx`.

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

## ⚠️ DRIFT — migration tracking out of sync with prod (recorded 2026-06-07)

Two prod schema changes were applied **outside** `drizzle-kit migrate`, so they are
**not recorded in `__drizzle_migrations`**. Prod and the migration journal have
drifted. Documented now while fresh; **reconcile properly later** (do NOT
`drizzle-kit push` against prod — PK 42P16 hazard per CLAUDE.md).

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

**Reconcile later (not now):** either (a) insert the matching rows into
`__drizzle_migrations` to mark `0028` (and a pgvector migration) as applied, or
(b) rebuild the journal from a verified prod snapshot. Verify against prod first;
never assume the journal is authoritative for `0028`/pgvector.

**Seeded data (not a migration):** `calendar_events` was data-seeded on
2026-06-07 (190 rows: MUHURAT 152 / FESTIVAL 32 / GOVT 6) via `db:seed:calendar`
from PowerShell — idempotent (run 1 = 190 inserted, run 2 = 0). Data only, no DDL.
