/**
 * Better Auth — PostgreSQL tables (Drizzle ORM)
 * packages/db/schema/auth.ts
 *
 * Better Auth uses nanoid strings for IDs (not UUID).
 * Auth table IDs are text; app-table FK columns referencing user.id are also text.
 *
 * Tables: user · session · account · verification
 * Plugins: phoneNumber (adds phoneNumber + phoneNumberVerified to user)
 * additionalFields: role · status (on user)
 */

import {
  pgTable, text, boolean, timestamp, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id:                   text('id').primaryKey(),
  name:                 text('name').notNull(),
  email:                text('email').unique(),
  emailVerified:        boolean('email_verified').notNull().default(false),
  image:                text('image'),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),

  // phoneNumber plugin
  phoneNumber:          text('phone_number').unique(),
  phoneNumberVerified:  boolean('phone_number_verified').notNull().default(false),

  // additionalFields
  role:   text('role').notNull().default('INDIVIDUAL'),
  status: text('status').notNull().default('PENDING_VERIFICATION'),

  // twoFactor plugin
  twoFactorEnabled:    boolean('two_factor_enabled').notNull().default(false),

  // Soft delete (30-day grace period before purge)
  deletionRequestedAt: timestamp('deletion_requested_at'),
  deletedAt:           timestamp('deleted_at'),
}, (t) => ({
  phoneIdx: index('user_phone_idx').on(t.phoneNumber),
  emailIdx: index('user_email_idx').on(t.email),
  delIdx:   index('user_deletion_idx').on(t.deletionRequestedAt),
}));

export const session = pgTable('session', {
  id:         text('id').primaryKey(),
  expiresAt:  timestamp('expires_at').notNull(),
  token:      text('token').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),
  userId:     text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (t) => ({
  tokenIdx: uniqueIndex('session_token_idx').on(t.token),
  userIdx:  index('session_user_idx').on(t.userId),
}));

export const account = pgTable('account', {
  id:                     text('id').primaryKey(),
  accountId:              text('account_id').notNull(),
  providerId:             text('provider_id').notNull(),
  userId:                 text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken:            text('access_token'),
  refreshToken:           text('refresh_token'),
  idToken:                text('id_token'),
  accessTokenExpiresAt:   timestamp('access_token_expires_at'),
  refreshTokenExpiresAt:  timestamp('refresh_token_expires_at'),
  scope:                  text('scope'),
  password:               text('password'),
  createdAt:              timestamp('created_at').notNull().defaultNow(),
  updatedAt:              timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userIdx:       index('account_user_idx').on(t.userId),
  uniqueAccount: uniqueIndex('account_unique_idx').on(t.providerId, t.accountId),
}));

export const verification = pgTable('verification', {
  id:          text('id').primaryKey(),
  identifier:  text('identifier').notNull(),
  value:       text('value').notNull(),
  expiresAt:   timestamp('expires_at').notNull(),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({
  identifierIdx: index('verification_identifier_idx').on(t.identifier),
}));

/**
 * Better Auth twoFactor plugin storage.
 * One row per user — secret + JSON-encoded backup-codes array.
 */
export const twoFactor = pgTable('two_factor', {
  id:           text('id').primaryKey(),
  userId:       text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  secret:       text('secret').notNull(),
  backupCodes:  text('backup_codes').notNull(), // JSON-encoded string[] (Better Auth convention)
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('two_factor_user_idx').on(t.userId),
}));

/**
 * Auth audit log. Append-only, queried by /me/security/events.
 * Events: LOGIN_SUCCESS, LOGIN_FAILED, OTP_SENT, OTP_VERIFIED, OTP_FAILED,
 *         OTP_LOCKED, LOGOUT, SESSION_REVOKED, ROLE_CHANGED, PHONE_CHANGED,
 *         EMAIL_CHANGED, MFA_ENABLED, MFA_DISABLED, MFA_VERIFIED, MFA_FAILED,
 *         ACCOUNT_DELETION_REQUESTED, ACCOUNT_DELETED, ACCOUNT_RESTORED,
 *         NEW_DEVICE_LOGIN, PASSWORD_CHANGED.
 */
export const authEvents = pgTable('auth_events', {
  id:          text('id').primaryKey(),
  userId:      text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  type:        text('type').notNull(),
  ipAddress:   text('ip_address'),
  userAgent:   text('user_agent'),
  metadata:    jsonb('metadata'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userTimeIdx: index('auth_events_user_time_idx').on(t.userId, t.createdAt),
  typeTimeIdx: index('auth_events_type_time_idx').on(t.type, t.createdAt),
}));

export type User       = typeof user.$inferSelect;
export type Session    = typeof session.$inferSelect;
export type AuthEvent  = typeof authEvents.$inferSelect;
export type TwoFactor  = typeof twoFactor.$inferSelect;
