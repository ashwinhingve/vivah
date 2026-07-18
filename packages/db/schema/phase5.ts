/**
 * Smart Shaadi — Phase 5 schema (Tier 0 contracts)
 * packages/db/schema/phase5.ts
 *
 * Vendor Utilization Engine · Calendar Intelligence · Dynamic Pricing v1 ·
 * B2B self-serve · Documentation & e-sign.
 *
 * Money is stored as **integer paise** in `bigint` columns (mode: 'bigint') —
 * never float/decimal — paired with a `money_currency` enum. This seeds the
 * Phase 7 `Money` value type early instead of retrofitting it.
 *
 * `vendor_leads` is NOT defined here — it already exists (migration 0022 +
 * schema/index.ts). The VUE reads it; this tier does not touch it.
 *
 * Every profile-keyed FK references `profiles.id` (UUID), cascade-on-delete —
 * never the Better Auth `user.id` (text).
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, date, integer, bigint, doublePrecision, jsonb,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { profiles } from './index';

// ── SHARED ENUMS ─────────────────────────────────────────────────────────────
//
// `money_currency` now lives in the leaf module `./sharedEnums` so that
// schema/index.ts can use it in the `profiles` table body without creating a
// body-level read across the index↔phase5 ES module cycle (Sprint G). Re-exported
// here so existing `from './phase5'` imports keep working.

export { moneyCurrencyEnum } from './sharedEnums';
import { moneyCurrencyEnum } from './sharedEnums';

// ── VENDOR UTILIZATION ENGINE — capacity windows ─────────────────────────────

export const capacityStatusEnum = pgEnum('capacity_status', ['OPEN', 'HELD', 'BOOKED', 'BLOCKED']);

export const vendorCapacity = pgTable('vendor_capacity', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  startAt:     timestamp('start_at').notNull(),
  endAt:       timestamp('end_at').notNull(),
  status:      capacityStatusEnum('status').default('OPEN').notNull(),
  maxBookings: integer('max_bookings').default(1).notNull(),
  bookedCount: integer('booked_count').default(0).notNull(),
  offSeason:   boolean('off_season').default(false).notNull(),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileStatusIdx: index('vendor_capacity_profile_status_idx').on(t.profileId, t.status, t.createdAt),
  windowIdx:        index('vendor_capacity_window_idx').on(t.startAt, t.endAt),
  // Monthly utilization rollup (analytics getUtilizationSeries): profile_id equality
  // + start_at range. Neither index above fits — profileStatusIdx diverges after the
  // leading column, windowIdx has no profile_id prefix.
  profileStartIdx:  index('vendor_capacity_profile_start_idx').on(t.profileId, t.startAt),
}));

// ── DYNAMIC PRICING v1 — vendor-set base + multiplier bounds ──────────────────

export const pricingRuleStatusEnum = pgEnum('pricing_rule_status', ['ACTIVE', 'INACTIVE']);

export const pricingRules = pgTable('pricing_rules', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  profileId:           uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  serviceCategory:     varchar('service_category', { length: 100 }).notNull(),
  basePaise:           bigint('base_paise', { mode: 'bigint' }).notNull(),
  currency:            moneyCurrencyEnum('currency').default('INR').notNull(),
  floorMultiplier:     doublePrecision('floor_multiplier').default(1).notNull(),
  ceilingMultiplier:   doublePrecision('ceiling_multiplier').default(1).notNull(),
  muhuratMultiplier:   doublePrecision('muhurat_multiplier').default(1).notNull(),
  offSeasonMultiplier: doublePrecision('off_season_multiplier').default(1).notNull(),
  demandMultiplier:    doublePrecision('demand_multiplier').default(1).notNull(),
  status:              pricingRuleStatusEnum('status').default('ACTIVE').notNull(),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
  updatedAt:           timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileStatusIdx: index('pricing_rules_profile_status_idx').on(t.profileId, t.status, t.createdAt),
}));

// ── CALENDAR INTELLIGENCE — muhurat / festival / school / govt overlays ───────

export const calendarEventKindEnum = pgEnum('calendar_event_kind', [
  'MUHURAT', 'FESTIVAL', 'SCHOOL', 'GOVT', 'REGIONAL', 'BLACKOUT',
]);
export const auspiciousBandEnum = pgEnum('auspicious_band', ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'PEAK']);

export const calendarEvents = pgTable('calendar_events', {
  id:             uuid('id').primaryKey().defaultRandom(),
  kind:           calendarEventKindEnum('kind').notNull(),
  name:           varchar('name', { length: 255 }).notNull(),
  eventDate:      date('event_date').notNull(),
  endDate:        date('end_date'),
  region:         varchar('region', { length: 100 }),               // null = national
  source:         varchar('source', { length: 100 }).notNull(),
  auspiciousBand: auspiciousBandEnum('auspicious_band').default('NONE').notNull(),
  metadata:       jsonb('metadata'),                                // tithi/nakshatra etc.
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  kindDateIdx: index('calendar_events_kind_date_idx').on(t.kind, t.eventDate),
  dateIdx:     index('calendar_events_date_idx').on(t.eventDate),
}));

// ── B2B SELF-SERVE — institutional buyer accounts ─────────────────────────────

export const b2bAccountStatusEnum = pgEnum('b2b_account_status', ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']);

export const b2bAccounts = pgTable('b2b_accounts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileId:      uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  legalName:      varchar('legal_name', { length: 255 }).notNull(),
  gstin:          varchar('gstin', { length: 15 }).notNull(),
  hsnSac:         varchar('hsn_sac', { length: 20 }),
  billingAddress: text('billing_address'),
  contactEmail:   varchar('contact_email', { length: 255 }),
  contactPhone:   varchar('contact_phone', { length: 20 }),
  status:         b2bAccountStatusEnum('status').default('PENDING').notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileStatusIdx: index('b2b_accounts_profile_status_idx').on(t.profileId, t.status),
  gstinIdx:         uniqueIndex('b2b_accounts_gstin_uniq').on(t.gstin),
}));

// ── DOCUMENTATION & E-SIGN — contract lifecycle ───────────────────────────────

export const contractStatusEnum = pgEnum('contract_status', ['DRAFT', 'SENT', 'SIGNED', 'VOID']);
export const esignProviderEnum = pgEnum('esign_provider', ['DIGILOCKER', 'SIGNZY']);

export const contracts = pgTable('contracts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileId:      uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  templateId:     varchar('template_id', { length: 100 }).notNull(),
  title:          varchar('title', { length: 255 }).notNull(),
  status:         contractStatusEnum('status').default('DRAFT').notNull(),
  provider:       esignProviderEnum('provider'),                    // null until sent
  signedAssetKey: varchar('signed_asset_key', { length: 500 }),     // R2 key of signed PDF
  contentHash:    varchar('content_hash', { length: 64 }),          // sha256, audit chain
  sentAt:         timestamp('sent_at'),
  signedAt:       timestamp('signed_at'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileStatusIdx: index('contracts_profile_status_idx').on(t.profileId, t.status, t.createdAt),
}));
