/**
 * Smart Shaadi — User Duplicate Signals Schema
 * packages/db/schema/duplicateSignals.ts
 *
 * Cross-account fingerprints emitted after successful KYC completion. Powers
 * duplicate-account detection across phone hash, Aadhaar reference ID, and
 * selfie face embeddings (CompareFaces source pool).
 *
 * One row per user; populated on KYC complete, never updated.
 */

import { pgTable, uuid, text, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const userDuplicateSignals = pgTable('user_duplicate_signals', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }).unique(),
  phoneHash:    varchar('phone_hash', { length: 64 }),
  aadhaarRefId: varchar('aadhaar_ref_id', { length: 100 }),
  selfieR2Key:  varchar('selfie_r2_key', { length: 500 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  phoneHashIdx:    index('user_duplicate_signals_phone_hash_idx').on(t.phoneHash),
  aadhaarRefIdx:   index('user_duplicate_signals_aadhaar_ref_idx').on(t.aadhaarRefId),
}));
