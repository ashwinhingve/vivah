-- Rollback for 0036_destination_wedding.sql (Phase 8 Sprint I, Unit 8.1).
--
-- DESTRUCTIVE: unlike rollback-0035 (index-only), this drops two tables and the
-- rows in them. Every destination leg and guest travel itinerary for every wedding
-- is lost. Snapshot both tables before running this if any real planning data has
-- been entered:
--
--   \copy wedding_destinations TO 'wedding_destinations.csv' CSV HEADER
--   \copy guest_travel_legs    TO 'guest_travel_legs.csv'    CSV HEADER
--
-- Ceremonies themselves are NOT lost — destination_id is only a nullable pointer,
-- and dropping the column detaches ceremonies from their legs without touching the
-- ceremony rows.
--
-- Order matters: guest_travel_legs references wedding_destinations, and ceremonies
-- holds an FK to it, so the child table and the FK column go first.

DROP TABLE IF EXISTS guest_travel_legs;--> statement-breakpoint

ALTER TABLE ceremonies DROP CONSTRAINT IF EXISTS ceremonies_destination_id_fk;--> statement-breakpoint
DROP INDEX IF EXISTS ceremonies_destination_idx;--> statement-breakpoint
ALTER TABLE ceremonies DROP COLUMN IF EXISTS destination_id;--> statement-breakpoint

DROP TABLE IF EXISTS wedding_destinations;
