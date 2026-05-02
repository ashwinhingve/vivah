/**
 * Smart Shaadi — Profile Boosts Schema
 * packages/db/schema/boosts.ts
 *
 * 24h paid visibility boost: boosted profiles surface in top 3 of opposite-side feeds.
 */

import { pgTable, pgEnum, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { profiles } from './index';

export const boostStatusEnum = pgEnum('boost_status', ['ACTIVE', 'EXPIRED', 'REFUNDED']);

export const profileBoosts = pgTable('profile_boosts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  activatedAt:  timestamp('activated_at').defaultNow().notNull(),
  expiresAt:    timestamp('expires_at').notNull(),
  paymentId:    varchar('payment_id', { length: 200 }),
  amountPaise:  varchar('amount_paise', { length: 20 }),
  status:       boostStatusEnum('status').default('ACTIVE').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx:    index('boost_profile_idx').on(t.profileId),
  activeIdx:     index('boost_active_idx').on(t.status, t.expiresAt),
}));
