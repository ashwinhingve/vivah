/**
 * Smart Shaadi — Family Mode (P3, Phase 3 item 9 + 10)
 *
 * Tables backing Family Compatibility Mode and Parent Mode:
 *   - parent_child_links     — parent acting on behalf of child user (with consent + permission tier)
 *   - family_match_ratings   — family members rate candidate matches for a subject user
 *   - parent_drafted_actions — actions a parent has drafted, awaiting child approval
 *
 * Distinct from family_members (familyExtras.ts) which is a profile-scoped roster
 * of relatives. parent_child_links is keyed on user.id and gates platform actions.
 */

import {
  pgTable, pgEnum, uuid, smallint, text, timestamp, index, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';
import { profiles } from './index';

export const parentLinkRelationshipEnum = pgEnum('parent_link_relationship', [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'SIBLING',
]);

export const parentLinkPermissionEnum = pgEnum('parent_link_permission', [
  'VIEW_ONLY',
  'EDIT_PROFILE',
  'DRAFT_ACTIONS',
  'FULL_PROXY',
]);

export const parentLinkConsentEnum = pgEnum('parent_link_consent', [
  'PENDING',
  'APPROVED',
  'REVOKED',
]);

export const parentActionTypeEnum = pgEnum('parent_action_type', [
  'SEND_INTEREST',
  'ACCEPT_INTEREST',
  'REJECT_INTEREST',
  'SEND_MESSAGE',
  'UPDATE_PROFILE',
  'BLOCK_USER',
]);

export const parentActionStatusEnum = pgEnum('parent_action_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'EXECUTED',
  'FAILED',
]);

export const parentChildLinks = pgTable('parent_child_links', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  parentUserId:        text('parent_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  childUserId:         text('child_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  relationship:        parentLinkRelationshipEnum('relationship').notNull(),
  permissions:         parentLinkPermissionEnum('permissions').notNull().default('VIEW_ONLY'),
  childConsentStatus:  parentLinkConsentEnum('child_consent_status').notNull().default('PENDING'),
  childConsentedAt:    timestamp('child_consented_at'),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  revokedAt:           timestamp('revoked_at'),
}, (t) => ({
  uniquePair:    uniqueIndex('parent_child_unique').on(t.parentUserId, t.childUserId),
  parentIdx:     index('parent_child_parent_idx').on(t.parentUserId),
  childIdx:      index('parent_child_child_idx').on(t.childUserId),
}));

export const familyMatchRatings = pgTable('family_match_ratings', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  raterUserId:              text('rater_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  subjectProfileId:         uuid('subject_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  candidateProfileId:       uuid('candidate_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  overallScore:             smallint('overall_score').notNull(),
  compatibilityConcerns:    text('compatibility_concerns').array(),
  notes:                    text('notes'),
  ratedAt:                  timestamp('rated_at').notNull().defaultNow(),
}, (t) => ({
  uniqueRating: uniqueIndex('family_rating_unique').on(t.raterUserId, t.candidateProfileId, t.subjectProfileId),
  subjectIdx:   index('family_rating_subject_idx').on(t.subjectProfileId, t.candidateProfileId),
}));

export const parentDraftedActions = pgTable('parent_drafted_actions', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  parentUserId:       text('parent_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  childUserId:        text('child_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  actionType:         parentActionTypeEnum('action_type').notNull(),
  payload:            jsonb('payload').notNull(),
  status:             parentActionStatusEnum('status').notNull().default('PENDING'),
  parentDraftedAt:    timestamp('parent_drafted_at').notNull().defaultNow(),
  childRespondedAt:   timestamp('child_responded_at'),
  executedAt:         timestamp('executed_at'),
  expiresAt:          timestamp('expires_at'),
  errorMessage:       text('error_message'),
}, (t) => ({
  childStatusIdx: index('parent_action_child_status_idx').on(t.childUserId, t.status),
  parentIdx:      index('parent_action_parent_idx').on(t.parentUserId, t.parentDraftedAt),
}));

export const parentChildLinksRelations = relations(parentChildLinks, ({ one }) => ({
  parent: one(user, { fields: [parentChildLinks.parentUserId], references: [user.id], relationName: 'parentLink_parent' }),
  child:  one(user, { fields: [parentChildLinks.childUserId],  references: [user.id], relationName: 'parentLink_child' }),
}));

export const familyMatchRatingsRelations = relations(familyMatchRatings, ({ one }) => ({
  rater:     one(user,     { fields: [familyMatchRatings.raterUserId],        references: [user.id] }),
  subject:   one(profiles, { fields: [familyMatchRatings.subjectProfileId],   references: [profiles.id], relationName: 'famRating_subject' }),
  candidate: one(profiles, { fields: [familyMatchRatings.candidateProfileId], references: [profiles.id], relationName: 'famRating_candidate' }),
}));

export const parentDraftedActionsRelations = relations(parentDraftedActions, ({ one }) => ({
  parent: one(user, { fields: [parentDraftedActions.parentUserId], references: [user.id], relationName: 'parentAction_parent' }),
  child:  one(user, { fields: [parentDraftedActions.childUserId],  references: [user.id], relationName: 'parentAction_child' }),
}));
