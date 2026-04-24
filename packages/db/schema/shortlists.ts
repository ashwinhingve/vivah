/**
 * Smart Shaadi — Shortlists Schema
 * packages/db/schema/shortlists.ts
 *
 * A shortlist is a one-sided bookmark: a profile pins another profile for
 * later review. It does NOT imply a match request has been sent.
 */

import {
  pgTable, uuid, text, timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { profiles } from './index';

export const shortlists = pgTable('shortlists', {
  id:              uuid('id').primaryKey().defaultRandom(),
  profileId:       uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  targetProfileId: uuid('target_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  note:            text('note'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniquePair:  uniqueIndex('shortlist_unique_pair').on(t.profileId, t.targetProfileId),
  profileIdx:  index('shortlist_profile_idx').on(t.profileId),
}));
