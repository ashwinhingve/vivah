/**
 * Smart Shaadi — User Reputation Signals Schema
 * packages/db/schema/reputationSignals.ts
 *
 * Per-user rolling-window rollup of trust/engagement metrics computed nightly
 * by behaviorAggregateJob. Consumed by the Reputation Score classifier in
 * apps/ai-service. One row per user; refreshed in-place each night.
 */

import { pgTable, text, integer, decimal, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const userReputationSignals = pgTable('user_reputation_signals', {
  userId:                  text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  responseRate:            decimal('response_rate', { precision: 5, scale: 4 }).notNull().default('0'),
  messageResponseRate:     decimal('message_response_rate', { precision: 5, scale: 4 }).notNull().default('0'),
  avgResponseTimeHours:    decimal('avg_response_time_hours', { precision: 6, scale: 2 }).notNull().default('36'),
  ghostCount:              integer('ghost_count').notNull().default(0),
  consistencyScore:        decimal('consistency_score', { precision: 5, scale: 4 }).notNull().default('0.5'),
  lastComputedAt:          timestamp('last_computed_at').defaultNow().notNull(),
});
