-- Rollback for 0035_scale_indexes.sql (Phase 8 Sprint H, Unit 8.3).
--
-- Drops only the three indexes 0035 created. Index drops do not touch row data,
-- so this is a safe, non-destructive rollback — the only effect is that the
-- analytics/reporting queries revert to their previous (slower) plans.

DROP INDEX IF EXISTS "payments_status_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "bookings_vendor_date_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "vendor_capacity_profile_start_idx";
