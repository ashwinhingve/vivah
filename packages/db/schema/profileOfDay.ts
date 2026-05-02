/**
 * Smart Shaadi — Profile of the Day Schema
 * packages/db/schema/profileOfDay.ts
 *
 * One PREMIUM profile per (date, gender, community) is featured daily on the dashboard.
 */

import { pgTable, uuid, varchar, date, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { profiles } from './index';

export const profileOfDay = pgTable('profile_of_day', {
  id:          uuid('id').primaryKey().defaultRandom(),
  profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  gender:      varchar('gender', { length: 20 }).notNull(),
  community:   varchar('community', { length: 100 }),
  date:        date('date').notNull(),
  selectedAt:  timestamp('selected_at').defaultNow().notNull(),
}, (t) => ({
  uniqueDay:   uniqueIndex('pod_unique_day').on(t.date, t.gender, t.community),
  dateIdx:     index('pod_date_idx').on(t.date),
}));
