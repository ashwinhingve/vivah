-- 0038_marketing_cities_registry.sql
-- Phase 6 Sprint J — Unit 6.4 Auto-Marketing Engine + Unit 6.5 Multi-City Registry.
--
-- 6.4 marketing_campaigns / campaign_content / campaign_sends — a full campaign
--     lifecycle on the retention_campaigns pattern (0033), generalized:
--       * marketing_campaigns — the definition: how it triggers (EVENT/SCHEDULED/
--         SEGMENT_SWEEP), who it targets (segment_key resolved lazily in SQL at
--         send time — no membership tables), which channels, what it counts as a
--         conversion, and a DRAFT→APPROVED→ACTIVE lifecycle. There is NO dry-run
--         fork: nothing sends until ACTIVE, and ACTIVE requires approved content.
--         Demo and launch behavior are identical by construction.
--       * campaign_content — LLM-generated (ai-service/Gemini) or fallback
--         template copy per language, DRAFT until an admin approves it.
--       * campaign_sends — one row per recipient attempt. The PARTIAL unique
--         index on (campaign_id, user_id) over open/terminal-positive states is
--         the idempotency guarantee: retries and overlapping sweeps cannot
--         double-message a user (same reasoning as retention 0033's open-attempt
--         index). SUPPRESSED rows record WHY someone was skipped (marketing
--         consent off, frequency cap) instead of skipping silently.
--     CONSENT: notification_preferences.marketing (default FALSE) is the opt-in
--     gate — enforced in the service layer before any queue insert; suppressed
--     sends are recorded. Frequency capping is Redis (mkt:cap:*), not schema.
--
-- 6.5 cities — normalized registry with an expansion lifecycle. vendors.city
--     free-text is deliberately UNTOUCHED (public filters + SEO depend on it);
--     the new nullable vendors.city_id is backfilled by exact name match and is
--     what the new density/ops dashboards join on. Rows that match no registry
--     city stay NULL and surface as "unmapped" in admin — never hidden.
--     The 10 registry rows are REFERENCE data (the SEO city set), not demo data,
--     so they are seeded here with fixed UUIDs, idempotently.
--
-- Additive + idempotent (safe to re-run). No DROP / ALTER COLUMN / type change.
-- Hand-authored per the 0033–0037 convention; apply locally with psql and on
-- prod via the Railway SQL console (never drizzle-kit push — 42P16).

-- ── enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE city_status AS ENUM ('ACTIVE', 'EXPANSION', 'PLANNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE marketing_trigger_type AS ENUM ('EVENT', 'SCHEDULED', 'SEGMENT_SWEEP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE marketing_campaign_status AS ENUM
    ('DRAFT', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE campaign_send_status AS ENUM
    ('QUEUED', 'SENT', 'CONVERTED', 'SUPPRESSED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE campaign_content_status AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE marketing_conversion_goal AS ENUM
    ('PROFILE_COMPLETED', 'BOOKING_CREATED', 'SUBSCRIPTION_STARTED', 'ANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ── cities (Unit 6.5) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cities (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        varchar(100) NOT NULL UNIQUE,
  slug                        varchar(100) NOT NULL UNIQUE,
  state                       varchar(100) NOT NULL,
  status                      city_status NOT NULL DEFAULT 'ACTIVE',
  target_vendors_per_category integer NOT NULL DEFAULT 3,
  latitude                    decimal(9,6),
  longitude                   decimal(9,6),
  display_order               integer NOT NULL DEFAULT 999,
  created_at                  timestamp NOT NULL DEFAULT now(),
  updated_at                  timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS cities_status_order_idx
  ON cities (status, display_order);--> statement-breakpoint

-- Reference rows: the 10-city SEO set (apps/web/src/lib/seo-data.ts). Fixed
-- UUIDs so every environment (and the demo seed) can address them by id.
INSERT INTO cities (id, name, slug, state, status, latitude, longitude, display_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Mumbai',    'mumbai',    'Maharashtra',    'ACTIVE', 19.076090, 72.877426, 1),
  ('c1000000-0000-0000-0000-000000000002', 'Delhi',     'delhi',     'Delhi NCR',      'ACTIVE', 28.613939, 77.209023, 2),
  ('c1000000-0000-0000-0000-000000000003', 'Bangalore', 'bangalore', 'Karnataka',      'ACTIVE', 12.971599, 77.594566, 3),
  ('c1000000-0000-0000-0000-000000000004', 'Hyderabad', 'hyderabad', 'Telangana',      'ACTIVE', 17.385044, 78.486671, 4),
  ('c1000000-0000-0000-0000-000000000005', 'Pune',      'pune',      'Maharashtra',    'ACTIVE', 18.520430, 73.856743, 5),
  ('c1000000-0000-0000-0000-000000000006', 'Jaipur',    'jaipur',    'Rajasthan',      'ACTIVE', 26.912434, 75.787270, 6),
  ('c1000000-0000-0000-0000-000000000007', 'Ahmedabad', 'ahmedabad', 'Gujarat',        'ACTIVE', 23.022505, 72.571365, 7),
  ('c1000000-0000-0000-0000-000000000008', 'Lucknow',   'lucknow',   'Uttar Pradesh',  'ACTIVE', 26.846695, 80.946167, 8),
  ('c1000000-0000-0000-0000-000000000009', 'Indore',    'indore',    'Madhya Pradesh', 'ACTIVE', 22.719569, 75.857726, 9),
  ('c1000000-0000-0000-0000-00000000000a', 'Bhopal',    'bhopal',    'Madhya Pradesh', 'ACTIVE', 23.259933, 77.412613, 10)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- ── vendors.city_id ───────────────────────────────────────────────────────────
-- NOTE: the Drizzle schema declares this column WITHOUT a .references() callback
-- and the FK is created here instead — cities lives in schema/phase6.ts which
-- imports schema/index.ts, so a JS-side reference from vendors (index.ts) back
-- to cities would close the ES-module cycle Sprint G's TDZ lesson warns about.
-- The database enforces integrity either way.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS city_id uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE vendors
    ADD CONSTRAINT vendors_city_id_fk
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS vendors_city_id_idx
  ON vendors (city_id);--> statement-breakpoint

-- Backfill by exact name match; re-runnable (only touches unmapped rows).
UPDATE vendors v
   SET city_id = c.id
  FROM cities c
 WHERE v.city_id IS NULL
   AND v.city = c.name;--> statement-breakpoint

-- ── marketing_campaigns (Unit 6.4) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     varchar(255) NOT NULL,
  description              text,
  trigger_type             marketing_trigger_type NOT NULL,
  segment_key              varchar(100) NOT NULL,
  channel_set              jsonb NOT NULL DEFAULT '["inapp"]'::jsonb,
  status                   marketing_campaign_status NOT NULL DEFAULT 'DRAFT',
  template_key             varchar(100) NOT NULL,
  schedule_config          jsonb,
  event_hook_key           varchar(100),
  frequency_cap_per_week   integer NOT NULL DEFAULT 2,
  conversion_goal          marketing_conversion_goal NOT NULL DEFAULT 'ANY',
  attribution_window_days  integer NOT NULL DEFAULT 14,
  created_by_user_id       text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_by_user_id      text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at              timestamp,
  created_at               timestamp NOT NULL DEFAULT now(),
  updated_at               timestamp NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaigns_attribution_ck
    CHECK (attribution_window_days BETWEEN 1 AND 90),
  CONSTRAINT marketing_campaigns_freq_cap_ck
    CHECK (frequency_cap_per_week >= 0)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS marketing_campaigns_status_idx
  ON marketing_campaigns (status, created_at);--> statement-breakpoint

-- The event dispatcher's only lookup: "ACTIVE campaigns for this hook".
CREATE INDEX IF NOT EXISTS marketing_campaigns_hook_idx
  ON marketing_campaigns (event_hook_key)
  WHERE status = 'ACTIVE';--> statement-breakpoint

-- ── campaign_content ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_content (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  template_key         varchar(100) NOT NULL,
  language             varchar(5) NOT NULL,
  status               campaign_content_status NOT NULL DEFAULT 'DRAFT',
  subject_line         varchar(255),
  body_short           varchar(500) NOT NULL,
  body_long            text,
  cta_text             varchar(100),
  cta_url              varchar(500),
  generated_by_llm     boolean NOT NULL DEFAULT false,
  generated_at         timestamp,
  model_version        varchar(60),
  approved_by_user_id  text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at          timestamp,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT campaign_content_language_ck CHECK (language IN ('en', 'hi'))
);--> statement-breakpoint

-- One live copy per campaign+language: the sender resolves content by campaign
-- and locale, so two non-archived rows for the same pair would be ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_content_live_uniq
  ON campaign_content (campaign_id, language)
  WHERE status IN ('DRAFT', 'APPROVED');--> statement-breakpoint

-- ── campaign_sends ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  user_id             text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status              campaign_send_status NOT NULL DEFAULT 'QUEUED',
  channel_sent        varchar(40),
  content_id          uuid REFERENCES campaign_content(id) ON DELETE SET NULL,
  sent_at             timestamp,
  converted_at        timestamp,
  conversion_details  jsonb,
  suppressed_reason   varchar(60),
  metadata            jsonb,
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Idempotency: one effective delivery per (campaign, user). SUPPRESSED/FAILED
-- rows fall outside so a later sweep MAY retry a user once the block clears.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_sends_dedup_uniq
  ON campaign_sends (campaign_id, user_id)
  WHERE status IN ('QUEUED', 'SENT', 'CONVERTED');--> statement-breakpoint

CREATE INDEX IF NOT EXISTS campaign_sends_campaign_idx
  ON campaign_sends (campaign_id, created_at);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS campaign_sends_user_idx
  ON campaign_sends (user_id, created_at);--> statement-breakpoint

-- Attribution sweep's working set: SENT rows still inside their window.
CREATE INDEX IF NOT EXISTS campaign_sends_open_sent_idx
  ON campaign_sends (status, sent_at)
  WHERE status = 'SENT';
