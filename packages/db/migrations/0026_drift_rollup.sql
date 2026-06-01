-- 0026 — Migration-history drift rollup (DR canonicalisation, 2026-05-31)
--
-- Captures schema objects that were applied to PRODUCTION out-of-band (via
-- `drizzle-kit push` and the hand-vetted SQL in docs/MIGRATIONS-PENDING.md)
-- but were never written as migration files. Without this rollup a fresh DB
-- built from migrations 0000–0025 alone does NOT reproduce production:
--
--   • vendor approval workflow (P1-8, applied to prod 2026-05-20):
--       enums vendor_status + rejection_category, six vendors columns,
--       two vendors indexes, five audit_event_type values.
--   • ceremony_type values TILAK + SAGAN and ceremonies.custom_type_name.
--   • weddings.deleted_at (soft-delete).
--
-- Fully idempotent (guards / IF NOT EXISTS) so it is a safe no-op on prod,
-- which already carries every object below. Proven via the scratch-DB replay
-- in docs/launch/dr-replay-verification.md.

-- ─── New enums ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."vendor_status" AS ENUM (
    'DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."rejection_category" AS ENUM (
    'INCOMPLETE_DOCS', 'POLICY_VIOLATION', 'IDENTITY_CONCERN', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Enum value additions (positioned to match schema source-of-truth) ─────
ALTER TYPE "public"."ceremony_type" ADD VALUE IF NOT EXISTS 'TILAK' BEFORE 'CORPORATE';
ALTER TYPE "public"."ceremony_type" ADD VALUE IF NOT EXISTS 'SAGAN' BEFORE 'CORPORATE';

ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'VENDOR_SUBMITTED'    BEFORE 'VENDOR_APPROVED';
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'VENDOR_UNDER_REVIEW' BEFORE 'VENDOR_APPROVED';
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'VENDOR_REJECTED'     AFTER  'VENDOR_APPROVED';
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'VENDOR_SUSPENDED'    AFTER  'VENDOR_REJECTED';
ALTER TYPE "public"."audit_event_type" ADD VALUE IF NOT EXISTS 'VENDOR_REINSTATED'   AFTER  'VENDOR_SUSPENDED';

-- ─── vendors: approval-workflow columns ────────────────────────────────────
-- status default APPROVED keeps existing public listings visible.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "status"              "public"."vendor_status" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "submitted_at"        timestamp;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "reviewed_at"         timestamp;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" text;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rejection_reason"    text;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rejection_category"  "public"."rejection_category";

DO $$ BEGIN
  ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_reviewed_by_user_id_user_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "vendor_status_idx"            ON "vendors" USING btree ("status");
CREATE INDEX IF NOT EXISTS "vendors_status_submitted_idx" ON "vendors" USING btree ("status", "submitted_at");

-- ─── ceremonies / weddings stragglers ──────────────────────────────────────
ALTER TABLE "ceremonies" ADD COLUMN IF NOT EXISTS "custom_type_name" varchar(100);
ALTER TABLE "weddings"   ADD COLUMN IF NOT EXISTS "deleted_at"        timestamp;
