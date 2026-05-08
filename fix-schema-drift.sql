-- ─────────────────────────────────────────────────────────────────────────────
-- Smart Shaadi — Schema drift repair (2026-05-08)
--
-- Reason: prod PG was created from an older schema. Code expects columns
-- that don't exist:
--   weddings:       partner_profile_id, title, venue_address, bride_name,
--                   groom_name, hashtag, primary_color
--   bookings:       wedding_id, ceremony_id, package_name, package_price,
--                   guest_count, event_location, proposed_date, proposed_by,
--                   proposed_reason, proposed_at
--   wedding_tasks:  parent_task_id, tags, estimated_hours, completed_at
--
-- Resulting bugs: GET /api/v1/weddings → 500, GET /api/v1/bookings → 500.
-- All ALTERs use IF NOT EXISTS so re-running is safe.
--
-- Run from PowerShell (WSL2 cannot reach Railway proxy):
--   $env:DATABASE_URL='postgres://...railway proxy...'
--   psql $env:DATABASE_URL -f fix-schema-drift.sql
--   Remove-Item Env:\DATABASE_URL
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- weddings ────────────────────────────────────────────────────────────────────
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_profile_id uuid REFERENCES profiles(id);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS title              varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS venue_address      text;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS bride_name         varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS groom_name         varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS hashtag            varchar(80);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS primary_color      varchar(20);

-- bookings ────────────────────────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wedding_id      uuid REFERENCES weddings(id) ON DELETE SET NULL;
-- ceremony_id may FK to ceremonies(id) per schema; if ceremonies table is
-- absent in prod, leave the FK off for now and add it when ceremonies lands.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ceremony_id     uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_name    varchar(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_price   numeric(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_count     integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_location  varchar(500);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date   date;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_by     text REFERENCES "user"(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_reason text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_at     timestamp;

-- Indexes the schema declares (idempotent via IF NOT EXISTS) ──────────────────
CREATE INDEX IF NOT EXISTS booking_wedding_idx  ON bookings(wedding_id);
CREATE INDEX IF NOT EXISTS booking_ceremony_idx ON bookings(ceremony_id);

-- wedding_tasks ───────────────────────────────────────────────────────────────
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS parent_task_id   uuid;
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS tags             text[] DEFAULT '{}';
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS estimated_hours  numeric(6,2);
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS completed_at     timestamp;

CREATE INDEX IF NOT EXISTS task_parent_idx ON wedding_tasks(parent_task_id);

COMMIT;

-- Verify ──────────────────────────────────────────────────────────────────────
\echo '--- weddings columns ---'
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='weddings' ORDER BY ordinal_position;

\echo '--- bookings columns ---'
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='bookings' ORDER BY ordinal_position;

\echo '--- wedding_tasks columns ---'
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='wedding_tasks' ORDER BY ordinal_position;
