/**
 * Smart Shaadi — Phase 7 schema (Sprint F, Unit 7.3)
 * packages/db/schema/phase7.ts
 *
 * Two durable tables that turn already-working-but-ephemeral features into
 * ones that persist, remind, and can be measured:
 *
 *  1. `virtual_dates` — a durable record of the scheduled video-date experience.
 *     The live Daily.co room + the Redis meeting proposal stay exactly as they
 *     are (proven, tested); this table adds history, a status lifecycle, the
 *     chosen icebreaker set, and per-participant post-date feedback so a "date"
 *     leaves a trace and can drive reminders + a reciprocal continue signal.
 *
 *  2. `retention_campaigns` — a durable record of every churn-recovery attempt.
 *     Stay Quotient already SCORES churn; nothing acted on it. Each row is one
 *     recovery attempt (band + action + outcome). Default posture is DRY_RUN:
 *     attempts are computed + stored for admin review but NO user is messaged
 *     until RETENTION_OUTREACH_LIVE is set — safe to run pre-launch.
 *
 * Profile-keyed FKs reference `profiles.id` (UUID). The retention row is keyed by
 * the Better Auth `user.id` (text) because churn scoring is user-scoped and the
 * notification pipeline delivers by user.id.
 */

import {
  pgTable, pgEnum, uuid, text, varchar, boolean,
  timestamp, integer, smallint, doublePrecision, jsonb,
  index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles, matchRequests, user } from './index';

// ── VIRTUAL DATE SYSTEM — durable layer over the ephemeral video/meeting flow ─

export const virtualDateStatusEnum = pgEnum('virtual_date_status', [
  'PROPOSED',   // scheduled by the proposer, awaiting the invitee's response
  'CONFIRMED',  // invitee accepted; reminders scheduled
  'COMPLETED',  // both participants submitted post-date feedback
  'CANCELLED',  // declined or cancelled before it happened
  'NO_SHOW',    // confirmed but nobody joined / no feedback within the window
]);

export const virtualDates = pgTable('virtual_dates', {
  id:              uuid('id').primaryKey().defaultRandom(),
  matchId:         uuid('match_id').notNull().references(() => matchRequests.id, { onDelete: 'cascade' }),
  proposedBy:      uuid('proposed_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  scheduledAt:     timestamp('scheduled_at').notNull(),
  durationMin:     integer('duration_min').default(30).notNull(),
  status:          virtualDateStatusEnum('status').default('PROPOSED').notNull(),
  roomName:        text('room_name'),                                  // set when the live room is created
  icebreakerSetKey: varchar('icebreaker_set_key', { length: 60 }),    // chosen curated prompt set
  notes:           text('notes'),
  // Per-participant post-date feedback (keyed by role: proposer vs invitee).
  proposerRating:   smallint('proposer_rating'),                       // 1..5, null until submitted
  inviteeRating:    smallint('invitee_rating'),
  proposerContinue: boolean('proposer_continue'),                      // wants to keep talking
  inviteeContinue:  boolean('invitee_continue'),
  completedAt:      timestamp('completed_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  matchStatusIdx: index('virtual_dates_match_status_idx').on(t.matchId, t.status, t.scheduledAt),
  scheduledIdx:   index('virtual_dates_scheduled_idx').on(t.scheduledAt),
  statusIdx:      index('virtual_dates_status_idx').on(t.status),
}));

// ── CHURN RECOVERY — one row per recovery attempt + its outcome ───────────────

// Mirrors the Stay Quotient risk bands (StayRiskBand in stayService.ts).
export const retentionRiskBandEnum = pgEnum('retention_risk_band', [
  'low', 'medium', 'high', 'critical',
]);

// Derived from Stay Quotient `recommended_action`; the action we actually take.
export const retentionActionTypeEnum = pgEnum('retention_action_type', [
  'WINBACK_OFFER',    // incentive nudge (e.g. boost/discount copy)
  'RECOVERY_NUDGE',   // gentle re-engagement message
  'REENGAGE_MATCHES', // point them back at pending matches/requests
]);

export const retentionStatusEnum = pgEnum('retention_status', [
  'DRY_RUN',    // computed + stored, but NO user message sent (pre-launch default)
  'QUEUED',     // outreach enqueued to the notifications pipeline
  'SENT',       // notification delivered
  'CONVERTED',  // user became active again after the attempt
  'EXPIRED',    // attempt window elapsed with no conversion
  'SUPPRESSED', // deliberately not sent (e.g. opted out)
]);

export const retentionCampaigns = pgTable('retention_campaigns', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  riskBand:         retentionRiskBandEnum('risk_band').notNull(),
  churnProbability: doublePrecision('churn_probability').notNull(),    // 0..1 from Stay Quotient
  primarySignal:    varchar('primary_signal', { length: 120 }),
  actionType:       retentionActionTypeEnum('action_type').notNull(),
  channel:          varchar('channel', { length: 40 }),                // inapp/push/email/sms once sent
  status:           retentionStatusEnum('status').default('DRY_RUN').notNull(),
  sentAt:           timestamp('sent_at'),
  convertedAt:      timestamp('converted_at'),
  expiresAt:        timestamp('expires_at').notNull(),
  modelVersion:     varchar('model_version', { length: 40 }),
  metadata:         jsonb('metadata'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx:   index('retention_campaigns_status_idx').on(t.status),
  bandIdx:     index('retention_campaigns_band_idx').on(t.riskBand, t.createdAt),
  userIdx:     index('retention_campaigns_user_idx').on(t.userId, t.createdAt),
  // Idempotency: at most one OPEN attempt (DRY_RUN | QUEUED | SENT) per user.
  openAttemptUniq: uniqueIndex('retention_campaigns_open_attempt_uniq')
    .on(t.userId)
    .where(sql`status in ('DRY_RUN', 'QUEUED', 'SENT')`),
}));
