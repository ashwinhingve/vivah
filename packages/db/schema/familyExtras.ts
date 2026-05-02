/**
 * Smart Shaadi — Family Extras
 *
 * Tables that back the world-class Family feature for the matrimonial side:
 *   - family_members         — parent/sibling/guardian rows linked to a profile
 *   - family_verifications   — per-profile verification badge state
 *
 * The free-form bio/about/values still lives in MongoDB ProfileContent.family.
 * These tables hold structured rows the matchmaking engine and trust badges read.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';
import { profiles } from './index';

export const familyRelationshipEnum = pgEnum('family_relationship', [
  'FATHER',
  'MOTHER',
  'SIBLING',
  'GUARDIAN',
  'GRANDPARENT',
  'UNCLE',
  'AUNT',
  'COUSIN',
  'OTHER',
]);

export const familyVerificationBadgeEnum = pgEnum('family_verification_badge', [
  'NONE',
  'FAMILY_VERIFIED',
  'PARENT_VERIFIED',
]);

export const familyMembers = pgTable('family_members', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileId:      uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name:           varchar('name', { length: 255 }).notNull(),
  relationship:   familyRelationshipEnum('relationship').notNull(),
  isManaging:     boolean('is_managing').default(false).notNull(),
  managerUserId:  text('manager_user_id').references(() => user.id, { onDelete: 'set null' }),
  phone:          varchar('phone', { length: 15 }),
  email:          varchar('email', { length: 255 }),
  notes:          text('notes'),
  addedAt:        timestamp('added_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx: index('family_member_profile_idx').on(t.profileId),
}));

export const familyVerifications = pgTable('family_verifications', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').unique().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  isVerified:   boolean('is_verified').default(false).notNull(),
  verifiedAt:   timestamp('verified_at'),
  verifiedBy:   text('verified_by').references(() => user.id, { onDelete: 'set null' }),
  badge:        familyVerificationBadgeEnum('badge').default('NONE').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  profile: one(profiles, { fields: [familyMembers.profileId], references: [profiles.id] }),
  manager: one(user,     { fields: [familyMembers.managerUserId], references: [user.id] }),
}));

export const familyVerificationsRelations = relations(familyVerifications, ({ one }) => ({
  profile:  one(profiles, { fields: [familyVerifications.profileId], references: [profiles.id] }),
  verifier: one(user,     { fields: [familyVerifications.verifiedBy], references: [user.id] }),
}));
