/**
 * Smart Shaadi — Phase 8 schema (Sprint I, Unit 8.1)
 * packages/db/schema/phase8.ts
 *
 * The Destination Wedding planning core. A wedding carries a single
 * `venue_city`; real destination weddings run across several cities (Mehndi in
 * Delhi, Wedding in Udaipur) and the planner had nowhere to express that.
 *
 *  1. `wedding_destinations` — one city "leg": country, IANA timezone, and the
 *     arrive/depart window. Ceremonies attach to a leg via
 *     `ceremonies.destination_id`. `country_code` + `iana_timezone` follow the
 *     ISO-alpha-2 / IANA convention Sprint G set on `profiles` (migration 0034),
 *     so a leg and an NRI profile describe location identically.
 *
 *  2. `guest_travel_legs` — which guests travel to a leg and when they arrive
 *     and depart. INTER-CITY TRAVEL ONLY: accommodation already lives on
 *     `guests.room_number` and venue check-in on `guests.arrived_at`; neither is
 *     duplicated here.
 *
 * Two invariants are enforced by the DATABASE, not by application code, because
 * both race under concurrent requests (migration 0036):
 *   * `destinations_one_primary_idx` — a partial unique index giving one primary
 *     leg per wedding.
 *   * `destinations_date_window_ck`  — CHECK (depart_on >= arrive_on).
 * Neither is expressible in Drizzle's table builder, so they exist in SQL only;
 * a write that violates them fails loudly rather than corrupting quietly.
 *
 * ── SUPPLY SIDE (migration 0037) ─────────────────────────────────────────────
 *
 * Sprint I's header said the catalogue and package tiers were "deliberately
 * absent — Tier 3, blocked on venue/vendor partnerships". That is no longer the
 * posture. The supply half is now built in full and seeded with FICTIONAL
 * placeholder inventory so the feature works end-to-end before any partner
 * signs; see §"Placeholder supply" below. The partnership blocker still governs
 * whether the inventory is REAL, not whether the code exists.
 *
 *  3. `premium_packages` (+ `_inclusions`, `_availability`) — priced, tiered
 *     destination packages hanging off an existing `vendors` row, so packages
 *     inherit vendor browse, portfolio, reviews and blocked dates for free
 *     rather than duplicating a parallel supplier model.
 *
 *  4. `post_marriage_categories` / `service_partners` /
 *     `post_marriage_services` / `service_enquiries` — Unit 8.2. Partners are
 *     NOT vendors (they never take a wedding booking, and the reply actor
 *     differs), so they get their own tables rather than overloading `vendors`.
 *
 * ── Placeholder supply ───────────────────────────────────────────────────────
 *
 * `is_placeholder` marks a row as seeded fictional inventory rather than a real
 * onboarded partner. It is an INTERNAL PROVENANCE MARKER: it must never hide a
 * row, degrade its ranking, or change how it renders. Flipping it to false is
 * the entire act of promoting seed inventory to a real partner — no schema
 * change, no re-keying, no broken references.
 *
 * The one behaviour it does gate is COMMERCIAL: a placeholder package cannot be
 * booked or paid for, because no fictional venue can deliver the wedding. That
 * check lives in the service layer, not the UI, and the enquiry path stays fully
 * open so the lead is still captured.
 *
 * ── Money ────────────────────────────────────────────────────────────────────
 *
 * `decimal(12,2)` in RUPEES, matching `vendors.price_min`, `vendor_services`
 * and `bookings.package_price`. NOT the bigint-paise convention used in
 * phase5/6/7 — packages flow directly into `bookings`/`booking_addons`, so paise
 * here would force a conversion at every boundary this feature actually crosses.
 */

import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, date, integer, decimal,
  index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { weddings, ceremonies, guests, vendors, user } from './index';

// ── Destination legs ─────────────────────────────────────────────────────────

export const weddingDestinations = pgTable('wedding_destinations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  city:         varchar('city', { length: 100 }).notNull(),
  countryCode:  varchar('country_code', { length: 2 }).notNull().default('IN'),
  ianaTimezone: varchar('iana_timezone', { length: 64 }).notNull().default('Asia/Kolkata'),
  arriveOn:     date('arrive_on').notNull(),
  departOn:     date('depart_on').notNull(),
  sortOrder:    integer('sort_order').notNull().default(0),
  isPrimary:    boolean('is_primary').notNull().default(false),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  // Serves both the filter and the ORDER BY of the only hot read:
  // "list this wedding's legs in order".
  weddingSortIdx: index('destinations_wedding_sort_idx').on(t.weddingId, t.sortOrder),
}));

// ── Guest travel per leg ─────────────────────────────────────────────────────

export const guestTravelLegs = pgTable('guest_travel_legs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  destinationId:  uuid('destination_id').notNull().references(() => weddingDestinations.id, { onDelete: 'cascade' }),
  guestId:        uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  arrivalDate:    date('arrival_date'),
  // varchar(10) matches the existing ceremonies.start_time / end_time convention
  // in this schema rather than introducing a `time` column type.
  arrivalTime:    varchar('arrival_time', { length: 10 }),
  departureDate:  date('departure_date'),
  departureTime:  varchar('departure_time', { length: 10 }),
  travelNotes:    text('travel_notes'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  // One itinerary per guest per leg — the upsert target.
  guestPerLeg:   uniqueIndex('guest_travel_legs_unique').on(t.destinationId, t.guestId),
  // "Who arrives at this leg, and when" — the logistics view's only query.
  destinationIdx: index('guest_travel_legs_destination_idx').on(t.destinationId, t.arrivalDate),
  // "This guest's itinerary across every leg" — the per-guest drill-down.
  guestIdx:       index('guest_travel_legs_guest_idx').on(t.guestId),
}));

// ── Relations ────────────────────────────────────────────────────────────────

export const weddingDestinationsRelations = relations(weddingDestinations, ({ one, many }) => ({
  wedding:    one(weddings, { fields: [weddingDestinations.weddingId], references: [weddings.id] }),
  travelLegs: many(guestTravelLegs),
  ceremonies: many(ceremonies),
}));

export const guestTravelLegsRelations = relations(guestTravelLegs, ({ one }) => ({
  destination: one(weddingDestinations, {
    fields:     [guestTravelLegs.destinationId],
    references: [weddingDestinations.id],
  }),
  guest: one(guests, { fields: [guestTravelLegs.guestId], references: [guests.id] }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Unit 8.1 — Premium packages / destination supply (migration 0037)
// ═══════════════════════════════════════════════════════════════════════════

export const premiumPackageTierEnum = pgEnum('premium_package_tier', [
  'ESSENTIAL',
  'SIGNATURE',
  'LUXE',
]);

// INCLUSION and EXCLUSION share one table. "What you don't get" is as much a
// buying decision as "what you do", and a single ordered list keeps them
// rendering and sorting identically instead of drifting apart in two tables.
export const premiumPackageInclusionKindEnum = pgEnum('premium_package_inclusion_kind', [
  'INCLUSION',
  'EXCLUSION',
]);

export const premiumPackages = pgTable('premium_packages', {
  id:       uuid('id').primaryKey().defaultRandom(),
  // phase8 imports index, so this direction of reference is safe. (The reverse —
  // vendor_inquiries.package_id, declared in index.ts — is NOT, and is a bare
  // column with its FK in SQL only. Same reason as ceremonies.destination_id.)
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),

  // Stable, human-readable URL key. The detail page is /packages/[slug], so this
  // is the public identifier and must stay unique across the catalogue.
  slug:     varchar('slug', { length: 140 }).notNull(),
  title:    varchar('title', { length: 200 }).notNull(),
  tier:     premiumPackageTierEnum('tier').notNull().default('SIGNATURE'),

  // Denormalised from the vendor deliberately: a vendor may sell packages in
  // several cities, and browse filters on the PACKAGE's city, not the vendor's.
  destinationCity: varchar('destination_city', { length: 100 }).notNull(),
  countryCode:     varchar('country_code', { length: 2 }).notNull().default('IN'),

  // RUPEES — see the Money note in the file header.
  priceFrom: decimal('price_from', { precision: 12, scale: 2 }).notNull(),
  currency:  varchar('currency', { length: 3 }).notNull().default('INR'),

  guestCapacityMin: integer('guest_capacity_min').notNull().default(0),
  guestCapacityMax: integer('guest_capacity_max').notNull(),
  durationNights:   integer('duration_nights').notNull().default(1),

  summary:      varchar('summary', { length: 300 }),
  description:  text('description'),
  heroImageUrl: varchar('hero_image_url', { length: 500 }),

  isPlaceholder: boolean('is_placeholder').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  sortOrder:     integer('sort_order').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugUniq: uniqueIndex('premium_packages_slug_uniq').on(t.slug),
  // Mirrors the browse query's actual shape: filter by city, narrow by tier,
  // and always exclude inactive rows.
  browseIdx: index('premium_packages_browse_idx').on(t.destinationCity, t.tier, t.isActive),
  vendorIdx: index('premium_packages_vendor_idx').on(t.vendorId),
}));

export const premiumPackageInclusions = pgTable('premium_package_inclusions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  packageId: uuid('package_id').notNull()
    .references(() => premiumPackages.id, { onDelete: 'cascade' }),
  kind:      premiumPackageInclusionKindEnum('kind').notNull().default('INCLUSION'),
  label:     varchar('label', { length: 300 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  // Serves both the filter and the ORDER BY of the only read: "this package's
  // inclusions, in display order".
  packageSortIdx: index('premium_package_inclusions_sort_idx').on(t.packageId, t.kind, t.sortOrder),
}));

// Blocked WINDOWS, not per-day rows: a venue closes for a season, and storing
// 90 rows to say "monsoon" would be a worse answer to the same question.
export const premiumPackageAvailability = pgTable('premium_package_availability', {
  id:          uuid('id').primaryKey().defaultRandom(),
  packageId:   uuid('package_id').notNull()
    .references(() => premiumPackages.id, { onDelete: 'cascade' }),
  blockedFrom: date('blocked_from').notNull(),
  blockedTo:   date('blocked_to').notNull(),
  reason:      varchar('reason', { length: 255 }),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  // CHECK (blocked_to >= blocked_from) is SQL-only — Drizzle's table builder
  // cannot express it. Mirrors destinations_date_window_ck from 0036.
  packageIdx: index('premium_package_availability_idx').on(t.packageId, t.blockedFrom),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Unit 8.2 — Post-marriage services (migration 0037)
// ═══════════════════════════════════════════════════════════════════════════

export const servicePriceUnitEnum = pgEnum('service_price_unit', [
  'FIXED',
  'PER_HOUR',
  'PER_MONTH',
  'PER_PERSON',
  'QUOTE',
]);

export const serviceEnquiryStatusEnum = pgEnum('service_enquiry_status', [
  'OPEN',
  'CONTACTED',
  'CLOSED',
]);

// A TABLE, not a pgEnum. Categories are editorial and will change as the
// offering grows; an enum would need a migration to add "pet care" and could
// never remove one. Admin CRUD writes here instead.
export const postMarriageCategories = pgTable('post_marriage_categories', {
  id:          uuid('id').primaryKey().defaultRandom(),
  slug:        varchar('slug', { length: 80 }).notNull(),
  name:        varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  // lucide-react icon name, resolved client-side. Kept as a string so adding a
  // category never needs a code deploy.
  icon:        varchar('icon', { length: 60 }),
  sortOrder:   integer('sort_order').notNull().default(0),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugUniq: uniqueIndex('post_marriage_categories_slug_uniq').on(t.slug),
}));

export const servicePartners = pgTable('service_partners', {
  id:         uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull()
    .references(() => postMarriageCategories.id, { onDelete: 'restrict' }),
  name:       varchar('name', { length: 200 }).notNull(),
  slug:       varchar('slug', { length: 140 }).notNull(),

  // Nullable: several categories (legal assistance, gifting registry) are
  // delivered remotely and are not tied to a city at all.
  city:        varchar('city', { length: 100 }),
  state:       varchar('state', { length: 100 }),
  countryCode: varchar('country_code', { length: 2 }).notNull().default('IN'),

  description:  text('description'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  websiteUrl:   varchar('website_url', { length: 500 }),
  logoUrl:      varchar('logo_url', { length: 500 }),
  rating:       decimal('rating', { precision: 3, scale: 2 }).notNull().default('0'),

  isPlaceholder: boolean('is_placeholder').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugUniq:   uniqueIndex('service_partners_slug_uniq').on(t.slug),
  browseIdx:  index('service_partners_browse_idx').on(t.categoryId, t.isActive),
  cityIdx:    index('service_partners_city_idx').on(t.city),
}));

export const postMarriageServices = pgTable('post_marriage_services', {
  id:        uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull()
    .references(() => servicePartners.id, { onDelete: 'cascade' }),
  // Denormalised from the partner so browse-by-category needs no join, and so a
  // partner can list a service outside its primary category.
  categoryId: uuid('category_id').notNull()
    .references(() => postMarriageCategories.id, { onDelete: 'restrict' }),

  title:       varchar('title', { length: 200 }).notNull(),
  slug:        varchar('slug', { length: 140 }).notNull(),
  description: text('description'),

  // RUPEES. priceTo is nullable — a QUOTE-unit service has no upper bound, and
  // a fixed-price one has no range.
  priceFrom: decimal('price_from', { precision: 12, scale: 2 }),
  priceTo:   decimal('price_to', { precision: 12, scale: 2 }),
  priceUnit: servicePriceUnitEnum('price_unit').notNull().default('FIXED'),
  currency:  varchar('currency', { length: 3 }).notNull().default('INR'),

  isPlaceholder: boolean('is_placeholder').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  sortOrder:     integer('sort_order').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugUniq:   uniqueIndex('post_marriage_services_slug_uniq').on(t.slug),
  browseIdx:  index('post_marriage_services_browse_idx').on(t.categoryId, t.isActive, t.sortOrder),
  partnerIdx: index('post_marriage_services_partner_idx').on(t.partnerId),
}));

// Separate from vendor_inquiries on purpose: that table's FK is vendor_id and
// its reply actor is the vendor user. A service partner has no user account at
// all while it is placeholder inventory, so the reply is written by an admin.
export const serviceEnquiries = pgTable('service_enquiries', {
  id:        uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id').notNull()
    .references(() => postMarriageServices.id, { onDelete: 'cascade' }),
  partnerId: uuid('partner_id').notNull()
    .references(() => servicePartners.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => user.id),

  message:          text('message').notNull(),
  preferredContact: varchar('preferred_contact', { length: 20 }),
  city:             varchar('city', { length: 100 }),

  status:       serviceEnquiryStatusEnum('status').notNull().default('OPEN'),
  partnerReply: text('partner_reply'),
  repliedAt:    timestamp('replied_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  // "My enquiries", newest first — the customer-facing read.
  customerIdx: index('service_enquiries_customer_idx').on(t.customerId, t.createdAt),
  // The admin triage queue: open enquiries for a partner.
  partnerIdx:  index('service_enquiries_partner_idx').on(t.partnerId, t.status),
  serviceIdx:  index('service_enquiries_service_idx').on(t.serviceId),
}));

// ── Relations ────────────────────────────────────────────────────────────────

export const premiumPackagesRelations = relations(premiumPackages, ({ one, many }) => ({
  vendor:       one(vendors, { fields: [premiumPackages.vendorId], references: [vendors.id] }),
  inclusions:   many(premiumPackageInclusions),
  availability: many(premiumPackageAvailability),
}));

export const premiumPackageInclusionsRelations = relations(premiumPackageInclusions, ({ one }) => ({
  package: one(premiumPackages, {
    fields:     [premiumPackageInclusions.packageId],
    references: [premiumPackages.id],
  }),
}));

export const premiumPackageAvailabilityRelations = relations(premiumPackageAvailability, ({ one }) => ({
  package: one(premiumPackages, {
    fields:     [premiumPackageAvailability.packageId],
    references: [premiumPackages.id],
  }),
}));

export const postMarriageCategoriesRelations = relations(postMarriageCategories, ({ many }) => ({
  partners: many(servicePartners),
  services: many(postMarriageServices),
}));

export const servicePartnersRelations = relations(servicePartners, ({ one, many }) => ({
  category: one(postMarriageCategories, {
    fields:     [servicePartners.categoryId],
    references: [postMarriageCategories.id],
  }),
  services:  many(postMarriageServices),
  enquiries: many(serviceEnquiries),
}));

export const postMarriageServicesRelations = relations(postMarriageServices, ({ one, many }) => ({
  partner: one(servicePartners, {
    fields:     [postMarriageServices.partnerId],
    references: [servicePartners.id],
  }),
  category: one(postMarriageCategories, {
    fields:     [postMarriageServices.categoryId],
    references: [postMarriageCategories.id],
  }),
  enquiries: many(serviceEnquiries),
}));

export const serviceEnquiriesRelations = relations(serviceEnquiries, ({ one }) => ({
  service: one(postMarriageServices, {
    fields:     [serviceEnquiries.serviceId],
    references: [postMarriageServices.id],
  }),
  partner: one(servicePartners, {
    fields:     [serviceEnquiries.partnerId],
    references: [servicePartners.id],
  }),
  customer: one(user, { fields: [serviceEnquiries.customerId], references: [user.id] }),
}));
