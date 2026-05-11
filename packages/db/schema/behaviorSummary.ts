/**
 * Smart Shaadi — User Behavior Summary Schema
 * packages/db/schema/behaviorSummary.ts
 *
 * Per-user per-day rollup of behavior_events (MongoDB) into Postgres counters.
 * Populated nightly by behaviorAggregateJob; consumed by ML feature pipelines.
 */

import { pgTable, text, date, integer, decimal, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const userBehaviorSummary = pgTable('user_behavior_summary', {
  userId:                text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  day:                   date('day').notNull(),
  profileViewCount:      integer('profile_view_count').notNull().default(0),
  browseQueryCount:      integer('browse_query_count').notNull().default(0),
  messageCount:          integer('message_count').notNull().default(0),
  scrollDepthAvg:        decimal('scroll_depth_avg', { precision: 5, scale: 4 }).notNull().default('0'),
  photoExpansionCount:   integer('photo_expansion_count').notNull().default(0),
  totalRequestCount:     integer('total_request_count').notNull().default(0),
  updatedAt:             timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userDayUniq: uniqueIndex('user_behavior_summary_user_day_uniq').on(t.userId, t.day),
}));
