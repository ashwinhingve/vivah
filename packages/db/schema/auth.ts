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
  pgTable, text, boolean, timestamp,
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
}, (t) => ({
  phoneIdx: index('user_phone_idx').on(t.phoneNumber),
  emailIdx: index('user_email_idx').on(t.email),
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

export type User    = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
