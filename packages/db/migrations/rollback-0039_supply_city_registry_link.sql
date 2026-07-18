-- Rollback for 0039_supply_city_registry_link.sql (Phase 8, Units 8.1 + 8.2).
--
-- Non-destructive to inventory: the free-text destination_city / city columns are
-- the display source of truth and are untouched, so dropping the link loses only
-- the canonical join, not any package, partner or lead.
--
-- It DOES discard the backfilled links and any an operator corrected by hand.
-- Re-running 0039 rebuilds them by name match, but a hand-correction that
-- disagreed with the free-text name will not come back. Snapshot first if any
-- were made:
--   \copy (SELECT id, destination_city, city_id FROM premium_packages) TO 'pkg_city_links.csv' CSV HEADER
--   \copy (SELECT id, city, city_id FROM service_partners) TO 'partner_city_links.csv' CSV HEADER

ALTER TABLE service_partners
  DROP CONSTRAINT IF EXISTS service_partners_city_id_fk;--> statement-breakpoint
DROP INDEX IF EXISTS "service_partners_city_id_idx";--> statement-breakpoint
ALTER TABLE service_partners
  DROP COLUMN IF EXISTS city_id;--> statement-breakpoint

ALTER TABLE premium_packages
  DROP CONSTRAINT IF EXISTS premium_packages_city_id_fk;--> statement-breakpoint
DROP INDEX IF EXISTS "premium_packages_city_id_idx";--> statement-breakpoint
ALTER TABLE premium_packages
  DROP COLUMN IF EXISTS city_id;
