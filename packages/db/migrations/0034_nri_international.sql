-- 0034_nri_international.sql
-- Phase 7 Sprint G (Unit 7.2) — NRI / international matching.
--
-- Adds the international dimension to `profiles`. The driving problem is NOT a
-- missing feature — it is an active blocker: passesDistanceFilter (see
-- apps/api/src/matchmaking/filters.ts) compares haversine distance against a
-- 100km default whenever both sides have coordinates, so today EVERY
-- cross-border pair is silently hard-filtered out of the feed. These columns are
-- what let a bilateral, flag-gated escape hatch exist.
--
-- Postgres-vs-Mongo split: anything the hard-filter chain or an NRI search facet
-- reads on every feed build lives here. Descriptive free text (visa specifics,
-- relocation timeline, years abroad) stays in Mongo ProfileContent.nri. We store
-- NO visa numbers or documents — matching signal only, never a KYC record.
--
-- SAFETY: every added column is nullable or carries a default that reproduces
-- today's behaviour exactly (domestic Indian profile, not opted in). Backfilling
-- existing rows therefore changes no match result, and the whole unit stays
-- inert until NRI_MATCHING_LIVE is set.
--
-- Additive + idempotent (safe to re-run). Hand-authored to match the 0030–0033
-- convention; apply locally with psql and on prod via the Railway SQL console.
-- NEVER drizzle-kit push against prod (42P16 on Better Auth text-id PKs).

-- ── Enum (guarded) ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE residency_status AS ENUM
    ('CITIZEN','PERM_RESIDENT','WORK_VISA','STUDENT_VISA','DEPENDENT_VISA','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Columns on profiles ──────────────────────────────────────────────────────
-- country_of_residence / display_currency are NOT NULL with a default, so the
-- backfill is implicit and existing rows keep behaving as domestic INR profiles.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_of_residence  varchar(2)       NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS citizenship           varchar(2),
  ADD COLUMN IF NOT EXISTS residency_status      residency_status,
  ADD COLUMN IF NOT EXISTS willing_to_relocate   boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_nri_matching  boolean          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iana_timezone         varchar(64),
  ADD COLUMN IF NOT EXISTS display_currency      money_currency   NOT NULL DEFAULT 'INR';

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Compound: the NRI facet filters on opt-in first, then narrows by country.
CREATE INDEX IF NOT EXISTS profiles_nri_filter_idx
  ON profiles (open_to_nri_matching, country_of_residence);

-- Supports the timezone-aware reminder sweep grouping participants by zone.
CREATE INDEX IF NOT EXISTS profiles_timezone_idx
  ON profiles (iana_timezone);

-- ── Notes ────────────────────────────────────────────────────────────────────
-- `money_currency` already exists (created in 0028 for the Phase 5 pricing core).
-- Sprint G moved its TypeScript declaration from schema/phase5.ts to the leaf
-- module schema/sharedEnums.ts so schema/index.ts can use it in the `profiles`
-- table body without a body-level read across the index<->phase5 ES module cycle.
-- That is a pure code move: same PG type name, same 8 values, no DDL here.
