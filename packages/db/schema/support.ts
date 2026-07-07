/**
 * Smart Shaadi — Support Console (help-desk ticketing)
 *
 * Backs the SUPPORT role's unified triage console:
 *   - support_tickets  — one support case (customer-raised or system-escalated)
 *   - ticket_messages  — the conversation thread + internal agent notes
 *   - ticket_events    — append-only activity log (status/assign/priority/SLA)
 *
 * The console ALSO surfaces read-only signals that live elsewhere (chat-abuse
 * reports in Mongo `chat_reports`, disputed bookings, pending KYC appeals) — an
 * agent triages those by opening a linked ticket via `source`/`linkedRef*`.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, index, jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'ACCOUNT',
  'PAYMENT',
  'BOOKING',
  'MATCH_ABUSE',
  'KYC',
  'VENDOR',
  'TECHNICAL',
  'OTHER',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
]);

export const ticketSourceEnum = pgEnum('ticket_source', [
  'USER',
  'CHAT_REPORT',
  'DISPUTE',
  'KYC_APPEAL',
  'SYSTEM',
]);

export const ticketEventTypeEnum = pgEnum('ticket_event_type', [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'PRIORITY_CHANGED',
  'MESSAGE_ADDED',
  'RESOLVED',
  'REOPENED',
  'SLA_BREACHED',
]);

export const supportTickets = pgTable('support_tickets', {
  id:                uuid('id').primaryKey().defaultRandom(),
  subject:           varchar('subject', { length: 200 }).notNull(),
  description:       text('description'),
  category:          ticketCategoryEnum('category').notNull().default('OTHER'),
  priority:          ticketPriorityEnum('priority').notNull().default('NORMAL'),
  status:            ticketStatusEnum('status').notNull().default('OPEN'),
  source:            ticketSourceEnum('source').notNull().default('USER'),
  // Who raised it (nullable: SYSTEM-escalated tickets have no human author)
  raisedByUserId:    text('raised_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  assignedToUserId:  text('assigned_to_user_id').references(() => user.id, { onDelete: 'set null' }),
  // Back-link to the originating signal (booking id, chat_report id, kyc_appeal id, …)
  linkedRefType:     varchar('linked_ref_type', { length: 32 }),
  linkedRefId:       varchar('linked_ref_id', { length: 100 }),
  slaDueAt:          timestamp('sla_due_at'),
  firstRespondedAt:  timestamp('first_responded_at'),
  resolvedAt:        timestamp('resolved_at'),
  resolvedByUserId:  text('resolved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  statusPriorityIdx: index('support_ticket_status_priority_idx').on(t.status, t.priority),
  assigneeIdx:       index('support_ticket_assignee_idx').on(t.assignedToUserId),
  raisedByIdx:       index('support_ticket_raised_by_idx').on(t.raisedByUserId),
  sourceIdx:         index('support_ticket_source_idx').on(t.source),
  slaIdx:            index('support_ticket_sla_idx').on(t.slaDueAt),
}));

export const ticketMessages = pgTable('ticket_messages', {
  id:             uuid('id').primaryKey().defaultRandom(),
  ticketId:       uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorUserId:   text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
  body:           text('body').notNull(),
  isInternalNote: boolean('is_internal_note').notNull().default(false),
  attachments:    jsonb('attachments'), // string[] of R2 keys
  createdAt:      timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index('ticket_message_ticket_idx').on(t.ticketId, t.createdAt),
}));

export const ticketEvents = pgTable('ticket_events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  ticketId:     uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  actorUserId:  text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  eventType:    ticketEventTypeEnum('event_type').notNull(),
  meta:         jsonb('meta'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index('ticket_event_ticket_idx').on(t.ticketId, t.createdAt),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  raisedBy:   one(user, { fields: [supportTickets.raisedByUserId],   references: [user.id], relationName: 'ticket_raisedBy' }),
  assignedTo: one(user, { fields: [supportTickets.assignedToUserId], references: [user.id], relationName: 'ticket_assignedTo' }),
  resolvedBy: one(user, { fields: [supportTickets.resolvedByUserId], references: [user.id], relationName: 'ticket_resolvedBy' }),
  messages:   many(ticketMessages),
  events:     many(ticketEvents),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketMessages.ticketId], references: [supportTickets.id] }),
  author: one(user,          { fields: [ticketMessages.authorUserId], references: [user.id] }),
}));

export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
  ticket: one(supportTickets, { fields: [ticketEvents.ticketId], references: [supportTickets.id] }),
  actor:  one(user,          { fields: [ticketEvents.actorUserId], references: [user.id] }),
}));
