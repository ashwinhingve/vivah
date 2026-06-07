-- ============================================================================
-- Migration-drift reconcile — prod Railway Postgres (railway / PG 18.3) — 2026-06-07
-- ============================================================================
-- DISCOVERY (verified live 2026-06-07): `drizzle.__drizzle_migrations` DOES NOT
-- EXIST on prod. Prod was built entirely via `db:push` + Railway SQL console, never
-- `drizzle migrate`, so the migration history was never tracked at all. The "drift"
-- is therefore the whole tracking table, not just two missing rows.
--
-- Also verified on prod: calendar_events table present (0028 applied), `vector`
-- extension present, but profiles.ai_embedding / embedding_updated_at MISSING — i.e.
-- only `CREATE EXTENSION vector` of 0029 was ever run, not the columns/index.
--
-- WHAT THIS DOES (all additive, idempotent, ZERO existing-data risk):
--   1. Create the drizzle tracking table (drizzle-orm's exact DDL).
--   2. Finish 0029 — add the two missing profiles columns + HNSW index (every stmt
--      IF NOT EXISTS; no-op where present). This makes the 0029 marker truthful.
--   3. Baseline-seed ALL 30 migrations (0000…0029) with their real sha256(file) hash
--      and journal `when` millis, so __drizzle_migrations matches the files exactly.
--      Safe because prod's push-built schema already contains the cumulative schema;
--      this adopts the migration history onto it (standard push→migrate baseline).
--
-- After this, a fresh `drizzle migrate` sees 0029 as the high-water mark and applies
-- only genuinely-newer migrations (0030+). NO `drizzle-kit push` against prod, ever
-- (Better Auth PK 42P16 hazard — CLAUDE.md).
--
-- Hashes = sha256 of each migration .sql file (drizzle hashes raw file bytes).
-- created_at = `when` from migrations/meta/_journal.json. Do NOT hand-edit either.
--
-- ROLLBACK (full undo): scripts/db/rollback-drift-2026-06-07.sql
-- ============================================================================


-- ─── PART 0 — INSPECTION (read-only; run first) ─────────────────────────────
SELECT to_regclass('drizzle.__drizzle_migrations')  AS tracking_table,  -- NULL = absent
       to_regclass('public.calendar_events')        AS calendar_events,
       (SELECT extname FROM pg_extension WHERE extname='vector')        AS vector_ext,
       (SELECT string_agg(column_name, ', ')
          FROM information_schema.columns
         WHERE table_name='profiles'
           AND column_name IN ('ai_embedding','embedding_updated_at'))  AS embedding_cols;


-- ─── PART 1 — RECONCILE (atomic) ────────────────────────────────────────────
BEGIN;

-- 1. Tracking table — drizzle-orm PG migrator's exact DDL. No-op if it already exists.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id         SERIAL PRIMARY KEY,
  hash       text NOT NULL,
  created_at bigint
);

-- 2. Finish 0029 (verbatim from migrations/0029_pgvector_embedding.sql — idempotent).
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ai_embedding" vector(1536);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "embedding_updated_at" timestamp;
CREATE INDEX IF NOT EXISTS "profiles_ai_embedding_hnsw_idx"
  ON "profiles" USING hnsw ("ai_embedding" vector_cosine_ops);

-- 3. Baseline-seed all 30 migrations. Each row inserted only if its hash is absent,
--    so re-running the whole file is a no-op. Ordered by `when` → ids 1..30 match a
--    real `drizzle migrate` run.
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT v.hash, v.created_at
FROM (VALUES
  ('b31cf715627a8c6003f1ab33b2c9c5ac86d5042366e7193f06c079d4629c3253', 1776251579710),  -- 0000_brave_zeigeist
  ('0e585a3bcbc6fccb0470bb85d82f70896aded7484ba6552ada8e62e13e55b098', 1776253965602),  -- 0001_aspiring_blacklash
  ('660314e0b6aac69aec80d4a8d69d0b2ea18a01dc088fa0ce2ec84b359e228acd', 1776499430991),  -- 0002_crazy_metal_master
  ('3363760b36b6cd7ae5a3446eff1fa55d66853e5f1ab824707c6acf64edc4b8b0', 1777059746232),  -- 0003_illegal_payback
  ('7c6e5d54479ff16d47bb90ab89542c416a3b4f07dad19a7de81a6e7486799340', 1777110253967),  -- 0004_salty_firebrand
  ('76b8b2a5d675b009f93be70e5c5ecd5c669f8168724a8aaf476a34c3b0754ce2', 1777312305796),  -- 0005_sparkling_menace
  ('6a5fa74f2c9a83f229678dffd570ae335712a27d600d0c664100b68f8dad8c21', 1777371454252),  -- 0006_grey_gauntlet
  ('4551ff92cc2dc9c082e78e028c46c6d360a94cbe144d46a93f3729ce36561c3f', 1777382817497),  -- 0007_known_sunspot
  ('df1825955bd064d3244ab1be5851b812756e967073b8b244b7dcec1d019863a8', 1777582284192),  -- 0008_peaceful_taskmaster
  ('dbc639d7ec8248653a703744431531f10393dd015857c62019b12bec3c000dff', 1777747344492),  -- 0009_overjoyed_flatman
  ('ba2f6c73c634b3023bba25dae21d8fb1266dac5d55d9050869d0df5298fa6855', 1777795541185),  -- 0010_friendly_shadowcat
  ('02b1deec48f80c5d4c2a86d608823f6aafe122f7f157a986cdf39604a7ef9d43', 1777920478076),  -- 0011_easy_ultimo
  ('12491d4ae6b170fb2237ac580fefc73cb85830b4a63ed4619c04a623fd77c1e2', 1778148424377),  -- 0012_gigantic_boomer
  ('82c37c21315d5c804dd4d9393739f51681a1221e7b9ca717cb2554edc1d55457', 1778413423379),  -- 0013_nebulous_typhoid_mary
  ('980f823138e62cb6c8047b4cf6847f33f281dde6247cb10b68b7b70b3d54a3f3', 1778511381307),  -- 0014_acoustic_mimic
  ('8b65fe761b2acc2b0978cce62b9159aea6d2a4884ff7d5f456b285d965e636c1', 1778512174912),  -- 0015_soft_slipstream
  ('139f77597053f6d36a03da18766447b05bd0505c51a52c4de32149741c2fbf00', 1778512849986),  -- 0016_nappy_tusk
  ('6e1c0a8db6670d29519e000e89bca9bb8d793459584e3f5197ea4957cd56bb5a', 1778513819541),  -- 0017_tiresome_spirit
  ('1578c8a9d31e7f95e6e195c24bd4ba438f224f6ab360fd2c1b9426d603aec8c3', 1778525681559),  -- 0018_reputation_signals_and_hourly_hist
  ('02bbb0a5ada2b8da80df842bc5770c6b5f1f8b0389f9f8726542b489c13d37ed', 1778563551391),  -- 0019_lucky_cobalt_man
  ('e2f5dd61b03fb2b0d1390799516830b20dc8cc4616ad91060a25b8c6287ccfbc', 1778650000000),  -- 0020_marriage_readiness_display_toggle
  ('159e659f788e21193748fab5c30791f911ef1e593f585cf1be33a61976f37716', 1778675000000),  -- 0021_referral_programme
  ('244ece088d26c16bd34f73c6f38edc744279dabcd8a20c032d005a265586ce3e', 1778675060000),  -- 0022_vendor_leads
  ('cae69a09040ec105ca258df1ba043469b9e04e204dca35ac8216a436dc71040d', 1778675120000),  -- 0023_gdpr_consent_and_export
  ('fad37476892ce275ea9fca83e5160c49a3f82dda16e69eac4a1e9ab79faad2d2', 1778675180000),  -- 0024_family_compatibility_and_parent_mode
  ('32a0c9aaa2d37bf7df60e1469318e0d5b5c114bd5ff29f6d485e3b6261292cb8', 1779800000000),  -- 0025_lgbtq_support
  ('534e66c21ed5d672c17a6563ff304d20443897d035bad64d39f6b3d4cf31b5b6', 1780200000000),  -- 0026_drift_rollup
  ('396a25625f0db6f9da669d598aa7249a79b1138694cefe44cb98c97fcc04d1c5', 1780246783767),  -- 0027_invitation_builder
  ('d314cbec78d0bcce513233f0cc54bf27252c33fb2c640f4f025e2cc64d7b22fd', 1780731736029),  -- 0028_sturdy_next_avengers
  ('99eecc1608bba7c2a33e49e1b38dff9714cdce1e1645fb2ca011806d70dd9009', 1780735487081)   -- 0029_pgvector_embedding
) AS v(hash, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations m WHERE m.hash = v.hash
);

COMMIT;


-- ─── PART 2 — VERIFY (run after PART 1) ─────────────────────────────────────
-- Expected: 30 rows; high_water = 1780735487081; embedding cols now BOTH present.
SELECT count(*) AS rows, min(created_at) AS first_when, max(created_at) AS high_water
  FROM drizzle.__drizzle_migrations;

SELECT string_agg(column_name, ', ') AS embedding_cols
  FROM information_schema.columns
 WHERE table_name='profiles'
   AND column_name IN ('ai_embedding','embedding_updated_at');
