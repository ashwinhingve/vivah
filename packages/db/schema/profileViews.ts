/**
 * Smart Shaadi — Profile Views Schema
 * packages/db/schema/profileViews.ts
 *
 * Tracks who viewed whom (footprints / "Who viewed me" feature).
 */

import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { profiles } from './index';

export const profileViews = pgTable('profile_views', {
  id:              uuid('id').primaryKey().defaultRandom(),
  viewerProfileId: uuid('viewer_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  viewedProfileId: uuid('viewed_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  viewedAt:        timestamp('viewed_at').defaultNow().notNull(),
}, (t) => ({
  viewedByRecentIdx: index('profile_views_viewed_recent_idx').on(t.viewedProfileId, t.viewedAt),
  pairIdx:           index('profile_views_pair_idx').on(t.viewerProfileId, t.viewedProfileId),
}));
