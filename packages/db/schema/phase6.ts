/**
 * Smart Shaadi — Phase 6 schema (Tier 2/3 financial + WhatsApp shells)
 * packages/db/schema/phase6.ts
 *
 * A shared service-referral → commission model (lending + insurance) and the
 * WhatsApp Business message log. Everything here backs FLAGGED + MOCKED shells:
 * no live lender / insurer / Meta call ships until the matching *_LIVE flag AND
 * partner credentials land. The live swap is credentials-only, not a redesign.
 *
 * COMPLIANCE — store the MINIMUM only:
 *  - Commission (bigint paise) is the ONLY revenue line recorded. NEVER store
 *    interest, premium, the borrower's bank details, Aadhaar, or contacts/call
 *    logs. principal_paise / sum-assured is display-only.
 *  - Smart Shaadi is an LSP under the RBI (Digital Lending) Directions 2025 —
 *    never the lender. No money flows through us: disbursal is borrower-direct,
 *    repayment is RE-direct.
 *  - India-resident data only.
 *
 * Money is integer paise in `bigint(mode:'bigint')` paired with `money_currency`
 * — same convention as phase5.ts (the enum is imported, not re-declared).
 * Profile-keyed FKs reference `profiles.id` (UUID), never the Better Auth
 * `user.id` (text).
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, bigint, integer, decimal, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles, user } from './index';
import { moneyCurrencyEnum } from './sharedEnums';

// ── SHARED SERVICE-REFERRAL MODEL (lending + insurance) ──────────────────────
//
// Generalizes both financial shells:
//   lending:   referral → disbursal (FULFILLED) → commission (COMMISSIONED)
//   insurance: referral → policy    (FULFILLED) → commission (COMMISSIONED)
// This is NOT the user-growth `referrals` table (migration 0021, reward credits) —
// that one tracks signup rewards; this one tracks financial partner commissions.

export const serviceReferralKindEnum = pgEnum('service_referral_kind', ['LENDING', 'INSURANCE']);

export const serviceReferralStatusEnum = pgEnum('service_referral_status', [
  'SURFACED',      // offer/quote shown to the user
  'CONSENTED',     // user gave un-pre-ticked consent to be referred
  'SUBMITTED',     // handed to the partner (RE / insurer) — mock in this tier
  'FULFILLED',     // disbursal (lending) or policy issued (insurance)
  'COMMISSIONED',  // partner-paid commission recorded (our only revenue line)
  'DECLINED',      // user declined or partner rejected
  'EXPIRED',
]);

export const serviceReferrals = pgTable('service_referrals', {
  id:              uuid('id').primaryKey().defaultRandom(),
  profileId:       uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  kind:            serviceReferralKindEnum('kind').notNull(),
  status:          serviceReferralStatusEnum('status').default('SURFACED').notNull(),
  partnerRef:      varchar('partner_ref', { length: 120 }),         // opaque RE/insurer id — NO PII
  context:         varchar('context', { length: 40 }).notNull(),    // BOOKING | PLANNING | ...
  contextId:       uuid('context_id'),                              // booking/wedding id when applicable
  consentAt:       timestamp('consent_at'),
  consentVersion:  varchar('consent_version', { length: 20 }),
  principalPaise:  bigint('principal_paise', { mode: 'bigint' }),   // loan amount / sum-assured — DISPLAY ONLY
  commissionPaise: bigint('commission_paise', { mode: 'bigint' }),  // the ONLY revenue line
  currency:        moneyCurrencyEnum('currency').default('INR').notNull(),
  mock:            boolean('mock').default(true).notNull(),
  metadata:        jsonb('metadata'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileKindStatusIdx: index('service_referrals_profile_kind_status_idx')
    .on(t.profileId, t.kind, t.status, t.createdAt),
  statusIdx: index('service_referrals_status_idx').on(t.status),
}));

// ── WHATSAPP BUSINESS — outbound template message log ────────────────────────
//
// One row per outbound template send. In mock mode `status = MOCKED` and the
// provider call is never made (the payload is logged). Sends are ENQUEUED via
// Bull, never sent synchronously inside a request handler.

export const whatsappMessageStatusEnum = pgEnum('whatsapp_message_status', [
  'QUEUED', 'SENT', 'FAILED', 'MOCKED',
]);

export const whatsappMessages = pgTable('whatsapp_messages', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }), // null = system recipient
  toPhone:     varchar('to_phone', { length: 20 }).notNull(),
  template:    varchar('template', { length: 100 }).notNull(),
  params:      jsonb('params'),
  status:      whatsappMessageStatusEnum('status').default('QUEUED').notNull(),
  providerRef: varchar('provider_ref', { length: 120 }),
  error:       text('error'),
  mock:        boolean('mock').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx: index('whatsapp_messages_profile_idx').on(t.profileId, t.createdAt),
  statusIdx:  index('whatsapp_messages_status_idx').on(t.status),
}));

// ── MULTI-CITY REGISTRY (Unit 6.5, Sprint J, migration 0038) ─────────────────
//
// Normalized city registry with an expansion lifecycle. vendors.city free-text
// stays the source of truth for public filters + SEO; vendors.city_id (declared
// in index.ts WITHOUT a .references() callback — the FK lives in 0038 to avoid
// the phase6↔index ES-module cycle) is what the density/ops dashboards join on.
// The 10 reference rows are seeded in-migration with fixed UUIDs.

export const cityStatusEnum = pgEnum('city_status', [
  'ACTIVE',     // launched market — vendors recruited, density tracked vs target
  'EXPANSION',  // actively recruiting toward launch
  'PLANNED',    // on the map, no recruiting yet
]);

export const cities = pgTable('cities', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          varchar('name', { length: 100 }).unique().notNull(),
  slug:          varchar('slug', { length: 100 }).unique().notNull(),
  state:         varchar('state', { length: 100 }).notNull(),
  status:        cityStatusEnum('status').default('ACTIVE').notNull(),
  targetVendorsPerCategory: integer('target_vendors_per_category').default(3).notNull(),
  latitude:      decimal('latitude', { precision: 9, scale: 6 }),
  longitude:     decimal('longitude', { precision: 9, scale: 6 }),
  displayOrder:  integer('display_order').default(999).notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  statusOrderIdx: index('cities_status_order_idx').on(t.status, t.displayOrder),
}));

// ── AUTO-MARKETING ENGINE (Unit 6.4, Sprint J, migration 0038) ───────────────
//
// Generalized from retention_campaigns (0033). A campaign DEFINES targeting +
// trigger + channels + conversion goal; campaign_content holds per-language
// copy (LLM-generated or fallback template) behind an approval gate; each
// campaign_sends row is one recipient attempt. There is deliberately NO dry-run
// column: nothing sends until the campaign is ACTIVE, and activation requires
// approved content — demo and launch behavior are identical by construction.
// CONSENT: notification_preferences.marketing (default false) gates every send
// in the service layer; refusals are recorded as SUPPRESSED, never silent.
// Frequency capping lives in Redis (mkt:cap:${userId}:${isoWeek}), not schema.

export const marketingTriggerTypeEnum = pgEnum('marketing_trigger_type', [
  'EVENT',          // fired by a product event hook (registration, KYC, booking)
  'SCHEDULED',      // calendar-driven (e.g. festival/muhurat proximity)
  'SEGMENT_SWEEP',  // daily sweep evaluates the segment and fills the audience
]);

export const marketingCampaignStatusEnum = pgEnum('marketing_campaign_status', [
  'DRAFT',      // being authored; content may still be generating
  'APPROVED',   // admin approved; awaiting activation
  'ACTIVE',     // live — the only state the dispatcher/sweep will send for
  'PAUSED',     // temporarily halted; sends stop, attribution keeps running
  'COMPLETED',  // finished; kept for reporting
]);

export const campaignSendStatusEnum = pgEnum('campaign_send_status', [
  'QUEUED',      // send row created, notification enqueued
  'SENT',        // handed to the notification pipeline
  'CONVERTED',   // conversion goal met inside the attribution window
  'SUPPRESSED',  // deliberately not sent (no marketing consent, frequency cap)
  'FAILED',      // pipeline delivery failed after retries
]);

export const campaignContentStatusEnum = pgEnum('campaign_content_status', [
  'DRAFT', 'APPROVED', 'ARCHIVED',
]);

export const marketingConversionGoalEnum = pgEnum('marketing_conversion_goal', [
  'PROFILE_COMPLETED', 'BOOKING_CREATED', 'SUBSCRIPTION_STARTED', 'ANY',
]);

export const marketingCampaigns = pgTable('marketing_campaigns', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  varchar('name', { length: 255 }).notNull(),
  description:           text('description'),
  triggerType:           marketingTriggerTypeEnum('trigger_type').notNull(),
  segmentKey:            varchar('segment_key', { length: 100 }).notNull(),
  channelSet:            jsonb('channel_set').default(['inapp']).notNull(),
  status:                marketingCampaignStatusEnum('status').default('DRAFT').notNull(),
  templateKey:           varchar('template_key', { length: 100 }).notNull(),
  scheduleConfig:        jsonb('schedule_config'),
  eventHookKey:          varchar('event_hook_key', { length: 100 }),
  frequencyCapPerWeek:   integer('frequency_cap_per_week').default(2).notNull(),
  conversionGoal:        marketingConversionGoalEnum('conversion_goal').default('ANY').notNull(),
  attributionWindowDays: integer('attribution_window_days').default(14).notNull(),
  createdByUserId:       text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  approvedByUserId:      text('approved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  approvedAt:            timestamp('approved_at'),
  createdAt:             timestamp('created_at').defaultNow().notNull(),
  updatedAt:             timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx: index('marketing_campaigns_status_idx').on(t.status, t.createdAt),
  // The event dispatcher's only lookup: "ACTIVE campaigns for this hook".
  hookIdx:   index('marketing_campaigns_hook_idx')
    .on(t.eventHookKey)
    .where(sql`status = 'ACTIVE'`),
}));

export const campaignContent = pgTable('campaign_content', {
  id:               uuid('id').primaryKey().defaultRandom(),
  campaignId:       uuid('campaign_id').notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  templateKey:      varchar('template_key', { length: 100 }).notNull(),
  language:         varchar('language', { length: 5 }).notNull(),          // 'en' | 'hi' (CHECK in 0038)
  status:           campaignContentStatusEnum('status').default('DRAFT').notNull(),
  subjectLine:      varchar('subject_line', { length: 255 }),
  bodyShort:        varchar('body_short', { length: 500 }).notNull(),
  bodyLong:         text('body_long'),
  ctaText:          varchar('cta_text', { length: 100 }),
  ctaUrl:           varchar('cta_url', { length: 500 }),
  generatedByLlm:   boolean('generated_by_llm').default(false).notNull(),
  generatedAt:      timestamp('generated_at'),
  modelVersion:     varchar('model_version', { length: 60 }),
  approvedByUserId: text('approved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  approvedAt:       timestamp('approved_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  // One live copy per campaign+language — the sender resolves by (campaign,
  // locale); two non-archived rows for the same pair would be ambiguous.
  liveUniq: uniqueIndex('campaign_content_live_uniq')
    .on(t.campaignId, t.language)
    .where(sql`status in ('DRAFT', 'APPROVED')`),
}));

export const campaignSends = pgTable('campaign_sends', {
  id:                uuid('id').primaryKey().defaultRandom(),
  campaignId:        uuid('campaign_id').notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:            campaignSendStatusEnum('status').default('QUEUED').notNull(),
  channelSent:       varchar('channel_sent', { length: 40 }),
  contentId:         uuid('content_id').references(() => campaignContent.id, { onDelete: 'set null' }),
  sentAt:            timestamp('sent_at'),
  convertedAt:       timestamp('converted_at'),
  conversionDetails: jsonb('conversion_details'),
  suppressedReason:  varchar('suppressed_reason', { length: 60 }),
  metadata:          jsonb('metadata'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  // Idempotency: one effective delivery per (campaign, user). SUPPRESSED /
  // FAILED fall outside so a later sweep may retry once the block clears.
  dedupUniq: uniqueIndex('campaign_sends_dedup_uniq')
    .on(t.campaignId, t.userId)
    .where(sql`status in ('QUEUED', 'SENT', 'CONVERTED')`),
  campaignIdx: index('campaign_sends_campaign_idx').on(t.campaignId, t.createdAt),
  userIdx:     index('campaign_sends_user_idx').on(t.userId, t.createdAt),
  // Attribution sweep's working set: SENT rows still inside their window.
  openSentIdx: index('campaign_sends_open_sent_idx')
    .on(t.status, t.sentAt)
    .where(sql`status = 'SENT'`),
}));
