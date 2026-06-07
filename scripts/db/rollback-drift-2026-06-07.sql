-- ============================================================================
-- ROLLBACK for reconcile-drift-2026-06-07.sql — prod Railway Postgres
-- ============================================================================
-- Pre-state (verified live before the reconcile, 2026-06-07):
--   • drizzle.__drizzle_migrations did NOT exist.
--   • profiles.ai_embedding / embedding_updated_at did NOT exist.
--   • profiles_ai_embedding_hnsw_idx did NOT exist.
--   • `vector` extension WAS already present (pre-existing — do NOT drop it).
--   • calendar_events table WAS already present (pre-existing — do NOT touch).
--
-- Running this returns prod to exactly that pre-state. Order matters: drop the
-- index (depends on the column) before the column.
-- ============================================================================

BEGIN;

-- 3. Remove the seeded migration history (the whole table was created by the reconcile).
DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
DROP SCHEMA IF EXISTS drizzle;   -- only succeeds if empty; safe — reconcile created it empty-then-seeded

-- 2. Undo the 0029 completion (these were absent pre-reconcile).
DROP INDEX IF EXISTS "profiles_ai_embedding_hnsw_idx";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "embedding_updated_at";
ALTER TABLE "profiles" DROP COLUMN IF EXISTS "ai_embedding";

-- NOTE: `CREATE EXTENSION vector` is NOT reversed — it pre-existed the reconcile.

COMMIT;

-- Verify rollback:
SELECT to_regclass('drizzle.__drizzle_migrations') AS tracking_table,  -- expect NULL
       (SELECT string_agg(column_name, ', ') FROM information_schema.columns
         WHERE table_name='profiles'
           AND column_name IN ('ai_embedding','embedding_updated_at')) AS embedding_cols;  -- expect empty
