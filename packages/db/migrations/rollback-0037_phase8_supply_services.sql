-- Rollback for 0037_phase8_supply_services.sql (Phase 8, Units 8.1 + 8.2).
--
-- ⚠️ THIS ONE IS DESTRUCTIVE, unlike rollback-0035. 0037 created tables that hold
-- real rows: seeded package inventory, service partners, and — critically —
-- CUSTOMER ENQUIRIES captured against them. Dropping these tables destroys leads.
--
-- Before running this against anything but a scratch database, snapshot the two
-- tables that contain user-generated data:
--
--   \copy service_enquiries TO 'service_enquiries.csv' CSV HEADER
--   \copy (SELECT * FROM vendor_inquiries WHERE package_id IS NOT NULL)
--     TO 'package_enquiries.csv' CSV HEADER
--
-- Order matters: children before parents, because the FKs are RESTRICT/CASCADE.

-- ── 8.2 ──────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS service_enquiries;--> statement-breakpoint
DROP TABLE IF EXISTS post_marriage_services;--> statement-breakpoint
DROP TABLE IF EXISTS service_partners;--> statement-breakpoint
DROP TABLE IF EXISTS post_marriage_categories;--> statement-breakpoint

-- ── 8.1 ──────────────────────────────────────────────────────────────────────
-- Drop the FK and column on vendor_inquiries BEFORE premium_packages, otherwise
-- the referenced-table drop fails.
ALTER TABLE vendor_inquiries
  DROP CONSTRAINT IF EXISTS vendor_inquiries_package_id_fk;--> statement-breakpoint
DROP INDEX IF EXISTS "inquiry_package_idx";--> statement-breakpoint
ALTER TABLE vendor_inquiries
  DROP COLUMN IF EXISTS package_id;--> statement-breakpoint

DROP TABLE IF EXISTS premium_package_availability;--> statement-breakpoint
DROP TABLE IF EXISTS premium_package_inclusions;--> statement-breakpoint
DROP TABLE IF EXISTS premium_packages;--> statement-breakpoint

ALTER TABLE vendors
  DROP COLUMN IF EXISTS is_placeholder;--> statement-breakpoint

-- ── Enums (last — types cannot drop while any column still uses them) ────────
DROP TYPE IF EXISTS "public"."service_enquiry_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."service_price_unit";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."premium_package_inclusion_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."premium_package_tier";
