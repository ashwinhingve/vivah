/**
 * Smart Shaadi — Digital Invitation Builder (contract Item 16)
 *
 * One shareable e-invite card per wedding. The display content (couple names,
 * date, chosen muhurat, venue, ceremony list) is read LIVE from `weddings` /
 * `ceremonies` / Mongo muhurat — never duplicated here. This table only stores
 * the builder's own state: chosen template, custom message, publish status,
 * the public slug, and the rendered PDF asset key.
 *
 * RSVP is NOT re-implemented here — a public RSVP submitted via the invite slug
 * self-registers into the existing `guests` table (see invite.service.ts).
 *
 * Cascade-deletes from `weddings`, consistent with the rest of weddingExtras.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { weddings } from './index';

// ── ENUMS ──────────────────────────────────────────────────────────────────────

export const inviteStatusEnum = pgEnum('invite_status', ['DRAFT', 'PUBLISHED']);

// ── TABLE ───────────────────────────────────────────────────────────────────────

export const weddingInvites = pgTable('wedding_invites', {
  id:          uuid('id').primaryKey().defaultRandom(),
  weddingId:   uuid('wedding_id').unique().notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  slug:        varchar('slug', { length: 32 }).unique().notNull(),    // public, unguessable
  templateId:  varchar('template_id', { length: 50 }).default('classic-royal').notNull(),
  status:      inviteStatusEnum('status').default('DRAFT').notNull(),
  title:       varchar('title', { length: 255 }),     // optional heading override
  message:     text('message'),                        // couple's invite note
  rsvpEnabled: boolean('rsvp_enabled').default(true).notNull(),
  assetKey:    varchar('asset_key', { length: 500 }),  // R2 key of the rendered PDF
  publishedAt: timestamp('published_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugIdx: index('wedding_invites_slug_idx').on(t.slug),
}));

export const weddingInvitesRelations = relations(weddingInvites, ({ one }) => ({
  wedding: one(weddings, { fields: [weddingInvites.weddingId], references: [weddings.id] }),
}));
