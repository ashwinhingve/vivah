-- ─────────────────────────────────────────────────────────────────────────────
-- Smart Shaadi — Schema drift repair (2026-05-08, v2)
--
-- Comprehensive: covers every table flagged by audit-all-schema.js plus the
-- earlier weddings/bookings/wedding_tasks fix. All ALTERs use IF NOT EXISTS,
-- enums use DO/EXCEPTION duplicate_object guard. Re-running is safe.
--
-- Run via: node apply-schema-fix.js  (psql alternative for boxes without psql)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── ENUMS first ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE match_request_priority AS ENUM ('NORMAL', 'SUPER_LIKE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kyc_level AS ENUM ('NONE', 'BASIC', 'STANDARD', 'PREMIUM', 'ELITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ceremony_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── weddings (from earlier fix, kept idempotent) ─────────────────────────────
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_profile_id uuid REFERENCES profiles(id);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS title              varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS venue_address      text;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS bride_name         varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS groom_name         varchar(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS hashtag            varchar(80);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS primary_color      varchar(20);

-- ── bookings ─────────────────────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS wedding_id      uuid REFERENCES weddings(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ceremony_id     uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_name    varchar(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS package_price   numeric(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_count     integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_location  varchar(500);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date   date;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_by     text REFERENCES "user"(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_reason text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_at     timestamp;
CREATE INDEX IF NOT EXISTS booking_wedding_idx  ON bookings(wedding_id);
CREATE INDEX IF NOT EXISTS booking_ceremony_idx ON bookings(ceremony_id);

-- ── wedding_tasks ────────────────────────────────────────────────────────────
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS parent_task_id  uuid;
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS tags            text[] DEFAULT '{}';
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS estimated_hours numeric(6,2);
ALTER TABLE wedding_tasks ADD COLUMN IF NOT EXISTS completed_at    timestamp;
CREATE INDEX IF NOT EXISTS task_parent_idx ON wedding_tasks(parent_task_id);

-- ── match_requests (4 missing) ───────────────────────────────────────────────
ALTER TABLE match_requests ADD COLUMN IF NOT EXISTS priority           match_request_priority NOT NULL DEFAULT 'NORMAL';
ALTER TABLE match_requests ADD COLUMN IF NOT EXISTS acceptance_message text;
ALTER TABLE match_requests ADD COLUMN IF NOT EXISTS decline_reason     varchar(64);
ALTER TABLE match_requests ADD COLUMN IF NOT EXISTS seen_at            timestamp;

-- ── vendors (15 missing) ─────────────────────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tagline                   varchar(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description               text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cover_image_key           varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone                     varchar(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email                     varchar(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website                   varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS instagram                 varchar(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS years_active              integer;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS response_time_hours       integer DEFAULT 24;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_min                 numeric(12,2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_max                 numeric(12,2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS view_count                integer NOT NULL DEFAULT 0;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS favorite_count            integer NOT NULL DEFAULT 0;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_pct            numeric(5,2) NOT NULL DEFAULT 3.00;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_verification_status  varchar(16) NOT NULL DEFAULT 'PENDING';

-- ── guests (8 missing) ───────────────────────────────────────────────────────
ALTER TABLE guests ADD COLUMN IF NOT EXISTS plus_one_names         jsonb;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS age_group              varchar(10) NOT NULL DEFAULT 'ADULT';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_vip                 boolean NOT NULL DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS dietary_notes          text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS accessibility_notes    text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS invited_to_ceremonies  text[] DEFAULT '{}';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS arrived_at             timestamp;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_by          text REFERENCES "user"(id);
CREATE INDEX IF NOT EXISTS guest_arrived_idx ON guests(guest_list_id, arrived_at);

-- ── invitations (2 missing) ──────────────────────────────────────────────────
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS type           varchar(20) NOT NULL DEFAULT 'INVITATION';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS error_message  text;

-- ── notification_preferences (1 missing) ─────────────────────────────────────
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS muted_types jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── ceremonies (8 missing) ───────────────────────────────────────────────────
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS status          ceremony_status NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS venue_address   text;
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS dress_code      varchar(100);
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS expected_guests integer;
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS is_public       boolean NOT NULL DEFAULT false;
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS started_at      timestamp;
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS completed_at    timestamp;
ALTER TABLE ceremonies ADD COLUMN IF NOT EXISTS updated_at      timestamp NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS ceremonies_status_idx ON ceremonies(wedding_id, status);

-- ── kyc_verifications (38 missing — was a stub) ──────────────────────────────
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS aadhaar_verified_at         timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS selfie_r2_key               varchar(500);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS liveness_score              integer;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS liveness_video_r2_key       varchar(500);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS liveness_checked_at         timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS face_match_score            integer;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS face_match_checked_at       timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS pan_verified                boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS pan_ref_id                  varchar(100);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS pan_last4                   varchar(4);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS pan_verified_at             timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS bank_verified               boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS bank_ref_id                 varchar(100);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS bank_account_last4          varchar(4);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS bank_ifsc                   varchar(11);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS bank_verified_at            timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS address_verified            boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS address_verification_method varchar(30);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS address_verified_at         timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS employment_verified         boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS employment_method           varchar(30);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS employment_verified_at      timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS education_verified          boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS education_verified_at       timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS sanctions_checked_at        timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS sanctions_hit               boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS sanctions_lists             jsonb;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS criminal_check_ref          varchar(100);
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS criminal_checked_at         timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS criminal_cleared            boolean NOT NULL DEFAULT false;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS risk_score                  integer;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS risk_factors                jsonb;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS verification_level          kyc_level NOT NULL DEFAULT 'NONE';
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS expires_at                  timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS reverification_requested_at timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS attempt_count               integer NOT NULL DEFAULT 0;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS last_attempt_at             timestamp;
ALTER TABLE kyc_verifications ADD COLUMN IF NOT EXISTS locked_until                timestamp;
CREATE INDEX IF NOT EXISTS kyc_level_idx   ON kyc_verifications(verification_level);
CREATE INDEX IF NOT EXISTS kyc_expires_idx ON kyc_verifications(expires_at);
CREATE INDEX IF NOT EXISTS kyc_risk_idx    ON kyc_verifications(risk_score);

COMMIT;
