-- 0033_virtual_dates_retention.sql
-- Phase 7 Sprint F (Unit 7.3) — Virtual Date System + Churn Recovery.
--
-- Adds a DURABLE layer over two features that already work but leave no trace:
--   * virtual_dates      — persistent record of the scheduled video-date
--                          experience (the live Daily.co room + Redis meeting
--                          proposal are unchanged). Enables history, reminders,
--                          and a reciprocal "continue" signal from feedback.
--   * retention_campaigns — one row per churn-recovery attempt + its outcome.
--                          Stay Quotient already scores churn; this records what
--                          we did about it. Default posture is DRY_RUN — attempts
--                          are stored for admin review with NO user messaged until
--                          RETENTION_OUTREACH_LIVE is set. Safe pre-launch.
--
-- Additive + idempotent (safe to re-run). Hand-authored to match the 0030/0031/
-- 0032 convention; apply locally with psql and on prod via Railway SQL console.

-- ── Enums (guarded) ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE virtual_date_status AS ENUM
    ('PROPOSED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE retention_risk_band AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE retention_action_type AS ENUM
    ('WINBACK_OFFER','RECOVERY_NUDGE','REENGAGE_MATCHES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE retention_status AS ENUM
    ('DRY_RUN','QUEUED','SENT','CONVERTED','EXPIRED','SUPPRESSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── virtual_dates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS virtual_dates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            uuid NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
  proposed_by         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at        timestamp NOT NULL,
  duration_min        integer NOT NULL DEFAULT 30,
  status              virtual_date_status NOT NULL DEFAULT 'PROPOSED',
  room_name           text,
  icebreaker_set_key  varchar(60),
  notes               text,
  proposer_rating     smallint,
  invitee_rating      smallint,
  proposer_continue   boolean,
  invitee_continue    boolean,
  completed_at        timestamp,
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS virtual_dates_match_status_idx
  ON virtual_dates (match_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS virtual_dates_scheduled_idx
  ON virtual_dates (scheduled_at);
CREATE INDEX IF NOT EXISTS virtual_dates_status_idx
  ON virtual_dates (status);

-- ── retention_campaigns ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retention_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  risk_band         retention_risk_band NOT NULL,
  churn_probability double precision NOT NULL,
  primary_signal    varchar(120),
  action_type       retention_action_type NOT NULL,
  channel           varchar(40),
  status            retention_status NOT NULL DEFAULT 'DRY_RUN',
  sent_at           timestamp,
  converted_at      timestamp,
  expires_at        timestamp NOT NULL,
  model_version     varchar(40),
  metadata          jsonb,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retention_campaigns_status_idx
  ON retention_campaigns (status);
CREATE INDEX IF NOT EXISTS retention_campaigns_band_idx
  ON retention_campaigns (risk_band, created_at);
CREATE INDEX IF NOT EXISTS retention_campaigns_user_idx
  ON retention_campaigns (user_id, created_at);

-- Idempotency: at most one OPEN attempt (DRY_RUN | QUEUED | SENT) per user.
CREATE UNIQUE INDEX IF NOT EXISTS retention_campaigns_open_attempt_uniq
  ON retention_campaigns (user_id)
  WHERE status IN ('DRY_RUN', 'QUEUED', 'SENT');
