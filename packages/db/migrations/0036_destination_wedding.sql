-- 0036_destination_wedding.sql
-- Phase 8 Sprint I (Unit 8.1) — Destination Wedding Module, planning core.
--
-- A wedding currently carries a single venue_city. Real destination weddings run
-- across several cities (Mehndi in Delhi, Wedding in Udaipur) and the planner has
-- nowhere to express that. This adds the "leg" concept:
--
--   * wedding_destinations — one city leg: country, IANA timezone and the
--                            arrive/depart window. Ceremonies attach to a leg.
--   * guest_travel_legs    — which guests travel to a leg, and when they fly in
--                            and out. INTER-CITY TRAVEL ONLY. Accommodation
--                            (guests.room_number) and venue check-in
--                            (guests.arrived_at) already exist — not duplicated
--                            here.
--
-- Deliberately NOT in this migration: destination catalogue, package tiers, room
-- blocks, transport bookings. Those are supply-side (Tier 3) and blocked on venue
-- and vendor partnerships — see docs/phase-5-8/PHASE-5-8-ROADMAP.md §4 Phase 8.
--
-- Additive + idempotent (safe to re-run). No DROP / ALTER COLUMN / type change.
-- Hand-authored to match the 0033/0034/0035 convention; apply locally with psql
-- and on prod via the Railway SQL console (never drizzle-kit push — 42P16).

-- ── wedding_destinations ─────────────────────────────────────────────────────
-- country_code / iana_timezone mirror the ISO-alpha-2 + IANA convention Sprint G
-- established on profiles.country_of_residence and profiles.iana_timezone (0034),
-- so a leg and an NRI profile describe location the same way.
CREATE TABLE IF NOT EXISTS wedding_destinations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id     uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  city           varchar(100) NOT NULL,
  country_code   varchar(2) NOT NULL DEFAULT 'IN',
  iana_timezone  varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
  arrive_on      date NOT NULL,
  depart_on      date NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  is_primary     boolean NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now(),
  CONSTRAINT destinations_date_window_ck CHECK (depart_on >= arrive_on)
);--> statement-breakpoint

-- The only hot read is "list this wedding's legs in order"; the composite serves
-- both the equality filter and the sort, so the planner needs no separate sort.
CREATE INDEX IF NOT EXISTS destinations_wedding_sort_idx
  ON wedding_destinations (wedding_id, sort_order);--> statement-breakpoint

-- One primary leg per wedding, enforced by a PARTIAL unique index rather than in
-- application code. An app-level "clear then set" races under concurrent requests;
-- this makes the loser fail loudly instead of silently leaving two primaries.
CREATE UNIQUE INDEX IF NOT EXISTS destinations_one_primary_idx
  ON wedding_destinations (wedding_id) WHERE is_primary;--> statement-breakpoint

-- ── ceremonies.destination_id ────────────────────────────────────────────────
-- Nullable: existing ceremonies are unassigned, and a single-city wedding never
-- needs a leg. ON DELETE SET NULL so removing a leg DETACHES its ceremonies
-- rather than deleting them — losing a ceremony because a city changed would be
-- data loss the planner never asked for.
--
-- NOTE: the Drizzle schema declares this column WITHOUT a .references() callback
-- and the FK is created here instead. schema/phase8.ts imports from schema/index.ts,
-- so a JS-side reference back would close an ES module cycle and reintroduce the
-- order-dependent TDZ ReferenceError Sprint G hit (fixed there by extracting
-- schema/sharedEnums.ts). The database still enforces integrity either way.
ALTER TABLE ceremonies
  ADD COLUMN IF NOT EXISTS destination_id uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE ceremonies
    ADD CONSTRAINT ceremonies_destination_id_fk
    FOREIGN KEY (destination_id) REFERENCES wedding_destinations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS ceremonies_destination_idx
  ON ceremonies (destination_id);--> statement-breakpoint

-- ── guest_travel_legs ────────────────────────────────────────────────────────
-- arrival_time / departure_time are varchar(10) to match the existing
-- ceremonies.start_time / end_time convention in this schema, not a `time` type.
CREATE TABLE IF NOT EXISTS guest_travel_legs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id  uuid NOT NULL REFERENCES wedding_destinations(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  arrival_date    date,
  arrival_time    varchar(10),
  departure_date  date,
  departure_time  varchar(10),
  travel_notes    text,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now(),
  CONSTRAINT guest_travel_legs_unique UNIQUE (destination_id, guest_id)
);--> statement-breakpoint

-- "Who is arriving at this leg, and when" — the logistics view's only query.
CREATE INDEX IF NOT EXISTS guest_travel_legs_destination_idx
  ON guest_travel_legs (destination_id, arrival_date);--> statement-breakpoint

-- "This guest's itinerary across every leg" — the per-guest drill-down.
CREATE INDEX IF NOT EXISTS guest_travel_legs_guest_idx
  ON guest_travel_legs (guest_id);
