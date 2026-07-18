-- Phase 8 Sprint H (Unit 8.3) — scale hardening: analytics/reporting indexes.
--
-- Additive and idempotent: index-only, no DROP / ALTER COLUMN / type change.
-- Safe to re-run. See docs/handover/INDEX-PLAN.md for the query-cost rationale
-- behind each index (and for the ones deliberately NOT added).
--
-- These three back the analytics service (apps/api/src/analytics/analytics.service.ts),
-- which is the read path for the Unit 8.3 PDF reports. Each index was chosen against a
-- specific query; nothing speculative.

-- 1. getRevenueSeries(): WHERE created_at BETWEEN ? AND ?
--                          AND status IN ('CAPTURED','PARTIALLY_REFUNDED')
--    payments had NO index on created_at at all — only (booking_id) and (status).
--    The monthly revenue rollup therefore seq-scanned the whole table.
--    Composite order is equality/IN first, range second.
CREATE INDEX IF NOT EXISTS "payments_status_created_idx"
  ON "payments" USING btree ("status","created_at");--> statement-breakpoint

-- 2. getVendorRevenueSeries(): WHERE vendor_id = ?
--                                AND event_date BETWEEN ? AND ?
--                                AND status IN ('CONFIRMED','COMPLETED')
--    booking_vendor_idx covers only vendor_id, so the date range and status were
--    filtered as a heap recheck. Per-vendor reports are the hottest report path.
CREATE INDEX IF NOT EXISTS "bookings_vendor_date_status_idx"
  ON "bookings" USING btree ("vendor_id","event_date","status");--> statement-breakpoint

-- 3. getUtilizationSeries(): WHERE profile_id = ? AND start_at BETWEEN ? AND ?
--    Neither existing index fits: vendor_capacity_profile_status_idx is
--    (profile_id, status, created_at) — diverges after the leading column — and
--    vendor_capacity_window_idx is (start_at, end_at) with no profile_id prefix.
CREATE INDEX IF NOT EXISTS "vendor_capacity_profile_start_idx"
  ON "vendor_capacity" USING btree ("profile_id","start_at");
