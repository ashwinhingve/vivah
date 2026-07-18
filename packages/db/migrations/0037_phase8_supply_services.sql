-- 0037_phase8_supply_services.sql
-- Phase 8 — Unit 8.1 premium package supply + Unit 8.2 post-marriage services.
--
-- Sprint I (0036) built the destination PLANNING core and explicitly left the
-- supply half out as Tier 3, blocked on venue/vendor partnerships. This migration
-- builds that supply half, plus Unit 8.2, in full. The partnership blocker still
-- decides whether the inventory is REAL — it no longer decides whether the code
-- and schema exist. Seeded fictional inventory (is_placeholder = true) makes both
-- features work end-to-end until real partners sign.
--
--   8.1  premium_packages (+ _inclusions, _availability) — priced, tiered
--        destination packages hanging off an existing vendors row, so they
--        inherit vendor browse/portfolio/reviews/blocked-dates rather than
--        duplicating a parallel supplier model.
--        vendors.is_placeholder and vendor_inquiries.package_id are added here.
--
--   8.2  post_marriage_categories / service_partners / post_marriage_services /
--        service_enquiries — partners are NOT vendors (they never take a wedding
--        booking and the reply actor differs), so they get their own tables.
--
-- MONEY: decimal(12,2) in RUPEES, matching vendors.price_min, vendor_services and
-- bookings.package_price — NOT the bigint-paise convention of phase5/6/7.
-- Packages flow straight into bookings/booking_addons, so paise here would force
-- a conversion at every boundary this feature actually crosses.
--
-- IS_PLACEHOLDER is an internal provenance marker. It must never hide a row or
-- degrade its ranking. It gates exactly one thing, in the service layer: a
-- placeholder cannot be booked or paid for, because no fictional venue can
-- deliver a wedding. The enquiry path stays fully open so the lead is captured.
--
-- Additive + idempotent (safe to re-run). No DROP / ALTER COLUMN / type change.
-- Hand-authored to match the 0033/0034/0035/0036 convention; apply locally with
-- psql and on prod via the Railway SQL console (never drizzle-kit push — 42P16).

-- ── Enums ────────────────────────────────────────────────────────────────────
-- Postgres has no CREATE TYPE IF NOT EXISTS, hence the duplicate_object guard.
DO $$ BEGIN
  CREATE TYPE "public"."premium_package_tier" AS ENUM('ESSENTIAL', 'SIGNATURE', 'LUXE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."premium_package_inclusion_kind" AS ENUM('INCLUSION', 'EXCLUSION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."service_price_unit" AS ENUM('FIXED', 'PER_HOUR', 'PER_MONTH', 'PER_PERSON', 'QUOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."service_enquiry_status" AS ENUM('OPEN', 'CONTACTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ── vendors.is_placeholder ───────────────────────────────────────────────────
-- DEFAULT false so every existing vendor is correctly marked as real supply.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- ── premium_packages ─────────────────────────────────────────────────────────
-- destination_city is denormalised from the vendor on purpose: a vendor may sell
-- packages in several cities, and browse filters on the PACKAGE's city.
CREATE TABLE IF NOT EXISTS premium_packages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  slug               varchar(140) NOT NULL,
  title              varchar(200) NOT NULL,
  tier               "public"."premium_package_tier" NOT NULL DEFAULT 'SIGNATURE',
  destination_city   varchar(100) NOT NULL,
  country_code       varchar(2) NOT NULL DEFAULT 'IN',
  price_from         numeric(12,2) NOT NULL,
  currency           varchar(3) NOT NULL DEFAULT 'INR',
  guest_capacity_min integer NOT NULL DEFAULT 0,
  guest_capacity_max integer NOT NULL,
  duration_nights    integer NOT NULL DEFAULT 1,
  summary            varchar(300),
  description        text,
  hero_image_url     varchar(500),
  is_placeholder     boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now(),
  -- Enforced by the DATABASE rather than the service layer: a capacity range
  -- inverted by a bad admin edit would silently make the package unmatchable by
  -- every capacity filter instead of failing at the point of the mistake.
  CONSTRAINT premium_packages_capacity_ck CHECK (guest_capacity_max >= guest_capacity_min),
  CONSTRAINT premium_packages_price_ck    CHECK (price_from >= 0),
  CONSTRAINT premium_packages_nights_ck   CHECK (duration_nights >= 0)
);--> statement-breakpoint

-- The public detail route is /packages/[slug], so the slug IS the identifier.
CREATE UNIQUE INDEX IF NOT EXISTS premium_packages_slug_uniq
  ON premium_packages (slug);--> statement-breakpoint

-- Mirrors the browse query's actual shape: filter by city, narrow by tier, and
-- always exclude inactive rows.
CREATE INDEX IF NOT EXISTS premium_packages_browse_idx
  ON premium_packages (destination_city, tier, is_active);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS premium_packages_vendor_idx
  ON premium_packages (vendor_id);--> statement-breakpoint

-- ── premium_package_inclusions ───────────────────────────────────────────────
-- INCLUSION and EXCLUSION share one table: "what you don't get" is as much a
-- buying decision as "what you do", and one ordered list keeps them rendering
-- identically instead of drifting apart in two tables.
CREATE TABLE IF NOT EXISTS premium_package_inclusions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES premium_packages(id) ON DELETE CASCADE,
  kind       "public"."premium_package_inclusion_kind" NOT NULL DEFAULT 'INCLUSION',
  label      varchar(300) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Serves the filter AND the ORDER BY of the only read: "this package's
-- inclusions, grouped by kind, in display order".
CREATE INDEX IF NOT EXISTS premium_package_inclusions_sort_idx
  ON premium_package_inclusions (package_id, kind, sort_order);--> statement-breakpoint

-- ── premium_package_availability ─────────────────────────────────────────────
-- Blocked WINDOWS, not per-day rows: a venue closes for a monsoon season, and
-- 90 rows would be a worse answer to the same question.
CREATE TABLE IF NOT EXISTS premium_package_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   uuid NOT NULL REFERENCES premium_packages(id) ON DELETE CASCADE,
  blocked_from date NOT NULL,
  blocked_to   date NOT NULL,
  reason       varchar(255),
  created_at   timestamp NOT NULL DEFAULT now(),
  -- Mirrors destinations_date_window_ck from 0036.
  CONSTRAINT premium_package_availability_window_ck CHECK (blocked_to >= blocked_from)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS premium_package_availability_idx
  ON premium_package_availability (package_id, blocked_from);--> statement-breakpoint

-- ── vendor_inquiries.package_id ──────────────────────────────────────────────
-- Nullable: a plain vendor enquiry sets nothing and every existing row stays
-- NULL. Reusing this table rather than creating a second enquiry system means
-- package enquiries inherit the whole existing reply + notification workflow.
--
-- NOTE: the Drizzle schema declares this column WITHOUT a .references() callback
-- and the FK is created here instead — premium_packages lives in schema/phase8.ts
-- which imports schema/index.ts, so a JS-side reference back would close an ES
-- module cycle and reintroduce the order-dependent TDZ ReferenceError Sprint G
-- hit. Identical reasoning to ceremonies.destination_id in 0036.
--
-- ON DELETE SET NULL so retiring a package DETACHES its enquiries rather than
-- deleting them — a captured lead outlives the package it came from.
ALTER TABLE vendor_inquiries
  ADD COLUMN IF NOT EXISTS package_id uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE vendor_inquiries
    ADD CONSTRAINT vendor_inquiries_package_id_fk
    FOREIGN KEY (package_id) REFERENCES premium_packages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS inquiry_package_idx
  ON vendor_inquiries (package_id);--> statement-breakpoint

-- ── post_marriage_categories ─────────────────────────────────────────────────
-- A TABLE, not an enum. Categories are editorial and will change as the offering
-- grows; an enum would need a migration to add one and could never remove one.
CREATE TABLE IF NOT EXISTS post_marriage_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        varchar(80) NOT NULL,
  name        varchar(120) NOT NULL,
  description text,
  icon        varchar(60),
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS post_marriage_categories_slug_uniq
  ON post_marriage_categories (slug);--> statement-breakpoint

-- ── service_partners ─────────────────────────────────────────────────────────
-- city/state are NULLABLE: several categories (legal assistance, gifting
-- registry) are delivered remotely and are not tied to a city at all.
-- ON DELETE RESTRICT on the category — deleting a category that still has
-- partners should fail loudly, not orphan or cascade-destroy the supply.
CREATE TABLE IF NOT EXISTS service_partners (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid NOT NULL REFERENCES post_marriage_categories(id) ON DELETE RESTRICT,
  name           varchar(200) NOT NULL,
  slug           varchar(140) NOT NULL,
  city           varchar(100),
  state          varchar(100),
  country_code   varchar(2) NOT NULL DEFAULT 'IN',
  description    text,
  contact_email  varchar(255),
  contact_phone  varchar(20),
  website_url    varchar(500),
  logo_url       varchar(500),
  rating         numeric(3,2) NOT NULL DEFAULT 0,
  is_placeholder boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_partners_rating_ck CHECK (rating >= 0 AND rating <= 5)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS service_partners_slug_uniq
  ON service_partners (slug);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS service_partners_browse_idx
  ON service_partners (category_id, is_active);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS service_partners_city_idx
  ON service_partners (city);--> statement-breakpoint

-- ── post_marriage_services ───────────────────────────────────────────────────
-- category_id is denormalised from the partner so browse-by-category needs no
-- join, and so a partner can list a service outside its primary category.
-- price_to is nullable — a QUOTE-unit service has no upper bound and a fixed
-- price has no range.
CREATE TABLE IF NOT EXISTS post_marriage_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid NOT NULL REFERENCES service_partners(id) ON DELETE CASCADE,
  category_id    uuid NOT NULL REFERENCES post_marriage_categories(id) ON DELETE RESTRICT,
  title          varchar(200) NOT NULL,
  slug           varchar(140) NOT NULL,
  description    text,
  price_from     numeric(12,2),
  price_to       numeric(12,2),
  price_unit     "public"."service_price_unit" NOT NULL DEFAULT 'FIXED',
  currency       varchar(3) NOT NULL DEFAULT 'INR',
  is_placeholder boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now(),
  -- Only constrains the range when BOTH bounds are present; a NULL price_to
  -- means "from X" and must stay legal.
  CONSTRAINT post_marriage_services_price_ck
    CHECK (price_from IS NULL OR price_to IS NULL OR price_to >= price_from),
  CONSTRAINT post_marriage_services_price_nonneg_ck
    CHECK (price_from IS NULL OR price_from >= 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS post_marriage_services_slug_uniq
  ON post_marriage_services (slug);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS post_marriage_services_browse_idx
  ON post_marriage_services (category_id, is_active, sort_order);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS post_marriage_services_partner_idx
  ON post_marriage_services (partner_id);--> statement-breakpoint

-- ── service_enquiries ────────────────────────────────────────────────────────
-- Separate from vendor_inquiries on purpose: that table's FK is vendor_id and
-- its reply actor is the vendor's user account. A service partner has no user
-- account at all while it is placeholder inventory, so the reply is written by
-- an admin from the triage queue.
CREATE TABLE IF NOT EXISTS service_enquiries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        uuid NOT NULL REFERENCES post_marriage_services(id) ON DELETE CASCADE,
  partner_id        uuid NOT NULL REFERENCES service_partners(id) ON DELETE CASCADE,
  customer_id       text NOT NULL REFERENCES "user"(id),
  message           text NOT NULL,
  preferred_contact varchar(20),
  city              varchar(100),
  status            "public"."service_enquiry_status" NOT NULL DEFAULT 'OPEN',
  partner_reply     text,
  replied_at        timestamp,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

-- "My enquiries", newest first — the customer-facing read.
CREATE INDEX IF NOT EXISTS service_enquiries_customer_idx
  ON service_enquiries (customer_id, created_at);--> statement-breakpoint

-- The admin triage queue: open enquiries for a partner.
CREATE INDEX IF NOT EXISTS service_enquiries_partner_idx
  ON service_enquiries (partner_id, status);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS service_enquiries_service_idx
  ON service_enquiries (service_id);
