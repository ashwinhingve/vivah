-- rollback-0034_nri_international.sql
-- Reverses 0034_nri_international.sql (Phase 7 Sprint G, Unit 7.2).
--
-- DESTRUCTIVE: dropping these columns discards every user's stated country of
-- residence, residency status, timezone and NRI opt-in. Snapshot first:
--   \copy (SELECT id, country_of_residence, citizenship, residency_status,
--                 willing_to_relocate, open_to_nri_matching, iana_timezone,
--                 display_currency
--          FROM profiles) TO 'profiles_nri_backup.csv' CSV HEADER
--
-- Prefer setting NRI_MATCHING_LIVE=false over running this — the flag makes the
-- feature inert without touching data.

DROP INDEX IF EXISTS profiles_timezone_idx;
DROP INDEX IF EXISTS profiles_nri_filter_idx;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS display_currency,
  DROP COLUMN IF EXISTS iana_timezone,
  DROP COLUMN IF EXISTS open_to_nri_matching,
  DROP COLUMN IF EXISTS willing_to_relocate,
  DROP COLUMN IF EXISTS residency_status,
  DROP COLUMN IF EXISTS citizenship,
  DROP COLUMN IF EXISTS country_of_residence;

DROP TYPE IF EXISTS residency_status;

-- `money_currency` is NOT dropped — it predates this migration (0028) and is
-- still used by pricing_rules and service_referrals.
