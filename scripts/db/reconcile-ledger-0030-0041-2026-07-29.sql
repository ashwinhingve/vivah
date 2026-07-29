-- ============================================================================
-- Ledger reconcile for 0030–0041 — prod Railway Postgres (railway / PG 18.3) — 2026-07-29
-- ============================================================================
-- DISCOVERY (verified live 2026-07-29): every object from migrations 0030–0041
-- already exists on prod — pgvector ext, profiles.ai_embedding vector(768) +
-- HNSW index (0030), support_tickets (0031), service_referrals /
-- whatsapp_messages (0032), virtual_dates / retention_campaigns (0033),
-- residency columns (0034), scale indexes (0035), wedding_destinations /
-- guest_travel_legs (0036), premium_packages + supply tables (0037), cities +
-- marketing tables (0038), city_id links (0039), referral_credits_ledger
-- (0040), and all three audit_event_type values (0041). But
-- drizzle.__drizzle_migrations still stops at 0029 (30 rows, baseline-seeded
-- 2026-06-07 by scripts/db/reconcile-drift-2026-06-07.sql).
--
-- VERIFICATION RUN (2026-07-29, psql from WSL): files 0031–0041 re-applied with
-- ON_ERROR_STOP — all no-oped except 0038's guarded vendors.city_id backfill,
-- which linked 12 vendors whose city_id was still NULL (its designed idempotent
-- behaviour; pre-state snapshot + rollback in ~/prod-snapshots-2026-07-29/).
-- 0030 was NOT re-run: fully applied already, and a re-run would pointlessly
-- drop/recreate the HNSW index.
--
-- WHAT THIS DOES: seed the 12 missing ledger rows so the tracking table matches
-- the files on disk. hash = sha256 of the raw .sql file bytes (drizzle's
-- convention, same as the 2026-06-07 baseline). created_at = each file's git
-- add-commit time in millis (0030–0041 are absent from meta/_journal.json —
-- journal frozen at 0029, see docs/db/journal-drift.md — so there is no journal
-- `when` to use). Values are strictly monotonic and greater than 0029's
-- 1780735487081.
--
-- Idempotent: each row inserts only if its hash is absent.
-- ROLLBACK: DELETE FROM drizzle.__drizzle_migrations WHERE hash IN (list below).
-- ============================================================================

BEGIN;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT v.hash, v.created_at
FROM (VALUES
  ('f443365832fa6a0a47121d16ec8ff2813ad0bdc40029a0c8550255c8002649da', 1783351517000),  -- 0030_pgvector_embedding_768
  ('aa757b8f493c23f938fffedbf0f711b5e5c7841cbe18cf0781c364e7d41c75c0', 1783415763000),  -- 0031_support_tickets
  ('90935fa4ca509b8639a821e21f10a22006ac235eef121c0b730de50d199319c5', 1784336943000),  -- 0032_financial_shells
  ('945f7038954192ad8f96f279a18f37ef20d6ab4fd3795619c7e44959caffd38f', 1784360013000),  -- 0033_virtual_dates_retention
  ('e5ff0f245d4d743be17d14e9e749bf7296ca8d25f93cc5c277b5a14ce5327dc7', 1784366018000),  -- 0034_nri_international
  ('235c06b75b05d0d763032295356fccf7bfc414a5636efef81c278aa3a62beeea', 1784370852000),  -- 0035_scale_indexes
  ('136a44b5fa414fddb670a6c9d2122fe5a08341014e835c208fd823c823c36c3d', 1784381945000),  -- 0036_destination_wedding
  ('54ac64a0fd60ace2aa5319c4e82b783938d7b34a3fd105a050f43b97e42d9673', 1784398686000),  -- 0037_phase8_supply_services
  ('f4c55ae6293f2d075db318e79256ec0c7ea047bf58426a907546d14857a91bc5', 1784400299000),  -- 0038_marketing_cities_registry
  ('6adb77f438218d23105a19e1486d53921cfba80ff6544f5bcb6ec3fbd0de42ea', 1784418140000),  -- 0039_supply_city_registry_link
  ('6ad5d39b1090a897dd318b75cd0d25274a3fb3581424aea1354677953963ef51', 1784536610000),  -- 0040_referral_credits_ledger
  ('8de90010382154b34c6c2e9a3a62822014cfcf4e5220762517a609ce610d3f27', 1785219640000)   -- 0041_audit_event_types_p2_4
) AS v(hash, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations m WHERE m.hash = v.hash
);

COMMIT;

-- ─── VERIFY ──────────────────────────────────────────────────────────────────
-- Expected: 42 rows; high_water = 1785219640000 (0041).
SELECT count(*) AS rows, max(created_at) AS high_water
  FROM drizzle.__drizzle_migrations;
