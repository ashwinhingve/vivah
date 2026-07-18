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
  timestamp, bigint, jsonb, index,
} from 'drizzle-orm/pg-core';
import { profiles } from './index';
import { moneyCurrencyEnum } from './phase5';

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
