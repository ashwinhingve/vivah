-- 0039_supply_city_registry_link.sql
-- Phase 8 (Units 8.1 + 8.2) — bind supply to the admin-managed city registry.
--
-- 0037 stored a package's city as free text (`premium_packages.destination_city`)
-- and a partner's as free text (`service_partners.city`). Sprint J then landed the
-- `cities` registry (0038) with an /admin/cities dashboard — a single place where
-- an operator adds, renames and orders the cities the platform serves.
--
-- Two free-text city columns and one registry is one concept too many. Free text
-- also fragments the browse facet the moment someone types "udaipur" next to
-- "Udaipur": Postgres compares them as different values, so the filter grows two
-- chips that each return half the inventory.
--
-- This adds a NULLABLE city_id on both tables, mirroring exactly the pattern
-- Sprint J established on vendors (0038): the free-text column stays the public
-- display + SEO value and remains the source of truth for what renders, while
-- city_id is the canonical join for facets, dedup and ops. Nullable because:
--   * a package may name a destination the operator has not registered yet, and
--     must not be un-creatable until they do;
--   * several 8.2 partners (legal assistance, gifting registry) are delivered
--     remotely and have no city at all.
--
-- ON DELETE SET NULL: retiring a city from the registry must DETACH the supply
-- that referenced it, never delete priced inventory or a captured lead.
--
-- OPERATOR NOTE — destination cities vs operational markets. The registry seeded
-- 10 metro markets whose density is tracked against target_vendors_per_category
-- (default 3). A destination-wedding city such as Udaipur or Alibaug is NOT a
-- recruitment market: it has venues, not a vendor roster. Seeding one with the
-- default target would report a permanent false under-supply gap on the ops
-- dashboard, because cities/service.ts applies the target to every city
-- regardless of status. Destination cities are therefore registered with
-- target_vendors_per_category = 0, which makes that gap calculation correctly
-- report nothing. An operator who later decides to recruit vendors there raises
-- the number in /admin/cities — no migration, no code change.
--
-- Additive + idempotent (safe to re-run). No DROP / ALTER COLUMN / type change.

-- ── premium_packages.city_id ─────────────────────────────────────────────────
ALTER TABLE premium_packages
  ADD COLUMN IF NOT EXISTS city_id uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE premium_packages
    ADD CONSTRAINT premium_packages_city_id_fk
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS premium_packages_city_id_idx
  ON premium_packages (city_id);--> statement-breakpoint

-- ── service_partners.city_id ─────────────────────────────────────────────────
ALTER TABLE service_partners
  ADD COLUMN IF NOT EXISTS city_id uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE service_partners
    ADD CONSTRAINT service_partners_city_id_fk
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS service_partners_city_id_idx
  ON service_partners (city_id);--> statement-breakpoint

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Link any supply whose free-text city already matches a registered city, so the
-- two representations agree from the moment this migration lands rather than
-- only for rows written afterwards.
--
-- Case-insensitive and whitespace-trimmed on purpose: the fragmentation this
-- column exists to fix is already present in free text, so an exact match would
-- leave precisely the rows that most need linking unlinked.
--
-- Idempotent via the `city_id IS NULL` guard — a re-run cannot overwrite a link
-- an operator has since corrected by hand.
UPDATE premium_packages p
   SET city_id = c.id
  FROM cities c
 WHERE p.city_id IS NULL
   AND lower(trim(p.destination_city)) = lower(trim(c.name));--> statement-breakpoint

UPDATE service_partners s
   SET city_id = c.id
  FROM cities c
 WHERE s.city_id IS NULL
   AND s.city IS NOT NULL
   AND lower(trim(s.city)) = lower(trim(c.name));
