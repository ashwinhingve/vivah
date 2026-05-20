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
