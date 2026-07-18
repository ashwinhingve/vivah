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
 * Deliberately absent: destination catalogue, package tiers, room blocks,
 * transport bookings. Those are supply-side (Tier 3), blocked on venue/vendor
 * partnerships — see docs/phase-5-8/PHASE-5-8-ROADMAP.md §4, Phase 8.
 *
 * Two invariants are enforced by the DATABASE, not by application code, because
 * both race under concurrent requests (migration 0036):
 *   * `destinations_one_primary_idx` — a partial unique index giving one primary
 *     leg per wedding.
 *   * `destinations_date_window_ck`  — CHECK (depart_on >= arrive_on).
 * Neither is expressible in Drizzle's table builder, so they exist in SQL only;
 * a write that violates them fails loudly rather than corrupting quietly.
 */

import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, date, integer,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { weddings, ceremonies, guests } from './index';

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
