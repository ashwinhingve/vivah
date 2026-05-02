/**
 * Smart Shaadi — Wedding Planning Extras
 *
 * World-class wedding planning entities not present in the original schema:
 * expenses, day-of timeline, seating, documents, mood board, activity log,
 * member invites, vendor assignments, task comments/attachments, public
 * wedding website, gift registry, reminders.
 *
 * All tables cascade delete from `weddings` so removing a wedding is clean.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, date, integer, decimal, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth';
import {
  weddings,
  weddingTasks,
  guests,
  ceremonies,
  vendors,
  bookings,
} from './index';

// ── ENUMS ─────────────────────────────────────────────────────────────────────

export const weddingExpenseStatusEnum = pgEnum('wedding_expense_status', [
  'DRAFT',
  'DUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
]);

export const weddingDocumentTypeEnum = pgEnum('wedding_document_type', [
  'CONTRACT',
  'RECEIPT',
  'PERMIT',
  'ID',
  'INSURANCE',
  'INVOICE',
  'OTHER',
]);

export const moodBoardCategoryEnum = pgEnum('mood_board_category', [
  'DECOR',
  'ATTIRE',
  'MAKEUP',
  'VENUE',
  'FLORAL',
  'INVITATION',
  'CAKE',
  'OTHER',
]);

export const tableShapeEnum = pgEnum('seating_table_shape', [
  'ROUND',
  'RECT',
  'SQUARE',
  'OVAL',
]);

export const weddingMemberRoleEnum = pgEnum('wedding_member_role', [
  'OWNER',
  'EDITOR',
  'VIEWER',
]);

export const vendorAssignmentStatusEnum = pgEnum('wedding_vendor_status', [
  'SHORTLISTED',
  'INQUIRED',
  'BOOKED',
  'CONFIRMED',
  'CANCELLED',
]);

export const vendorAssignmentRoleEnum = pgEnum('wedding_vendor_role', [
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'CATERER',
  'DECORATOR',
  'MUSICIAN',
  'DJ',
  'MAKEUP_ARTIST',
  'MEHENDI_ARTIST',
  'PRIEST',
  'PLANNER',
  'TRANSPORT',
  'VENUE',
  'OTHER',
]);

export const invitationTypeEnum = pgEnum('invitation_type', [
  'SAVE_THE_DATE',
  'INVITATION',
  'RSVP_REMINDER',
  'THANK_YOU',
]);

export const guestAgeGroupEnum = pgEnum('guest_age_group', [
  'ADULT',
  'CHILD',
  'INFANT',
]);

export const weddingReminderTypeEnum = pgEnum('wedding_reminder_type', [
  'TASK_DUE',
  'RSVP_FOLLOWUP',
  'VENDOR_PAYMENT',
  'GUEST_REMINDER',
  'COUNTDOWN',
  'CEREMONY_T_30D',
  'CEREMONY_T_7D',
  'CEREMONY_T_1D',
  'CEREMONY_T_1H',
]);

export const giftRegistryStatusEnum = pgEnum('gift_registry_status', [
  'AVAILABLE',
  'CLAIMED',
  'PURCHASED',
]);

export const incidentSeverityEnum = pgEnum('wedding_incident_severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const coordinatorScopeEnum = pgEnum('wedding_coordinator_scope', [
  'VIEW',
  'EDIT',
  'DAY_OF',
  'FULL',
]);

// ── Wedding Expenses (line items, links to vendor/booking, receipt) ──────────

export const weddingExpenses = pgTable('wedding_expenses', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId:   uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'set null' }),
  category:     varchar('category', { length: 100 }).notNull(),  // matches budget category name
  label:        varchar('label', { length: 255 }).notNull(),
  vendorId:     uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  bookingId:    uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  amount:       decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paid:         decimal('paid', { precision: 12, scale: 2 }).default('0').notNull(),
  currency:     varchar('currency', { length: 3 }).default('INR').notNull(),
  dueDate:      date('due_date'),
  paidAt:       timestamp('paid_at'),
  status:       weddingExpenseStatusEnum('status').default('DRAFT').notNull(),
  receiptR2Key: varchar('receipt_r2_key', { length: 500 }),
  notes:        text('notes'),
  createdBy:    text('created_by').references(() => user.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:  index('expense_wedding_idx').on(t.weddingId),
  ceremonyIdx: index('expense_ceremony_idx').on(t.weddingId, t.ceremonyId),
  categoryIdx: index('expense_category_idx').on(t.weddingId, t.category),
  statusIdx:   index('expense_status_idx').on(t.status),
}));

// ── Day-of Timeline ──────────────────────────────────────────────────────────

export const weddingTimelineEvents = pgTable('wedding_timeline_events', {
  id:                uuid('id').primaryKey().defaultRandom(),
  weddingId:         uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId:        uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'set null' }),
  title:             varchar('title', { length: 255 }).notNull(),
  description:       text('description'),
  startTime:         timestamp('start_time').notNull(),
  endTime:           timestamp('end_time'),
  location:          varchar('location', { length: 255 }),
  assignedTo:        text('assigned_to').references(() => user.id),
  vendorId:          uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  sortOrder:         integer('sort_order').default(0).notNull(),
  vendorCheckedIn:   boolean('vendor_checked_in').default(false).notNull(),
  vendorCheckedInAt: timestamp('vendor_checked_in_at'),
  vendorCheckedInBy: text('vendor_checked_in_by').references(() => user.id),
  actualStartAt:     timestamp('actual_start_at'),
  actualEndAt:       timestamp('actual_end_at'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:    index('timeline_wedding_idx').on(t.weddingId),
  ceremonyIdx:   index('timeline_ceremony_idx').on(t.ceremonyId),
  startTimeIdx:  index('timeline_start_idx').on(t.weddingId, t.startTime),
}));

// ── Seating ───────────────────────────────────────────────────────────────────

export const weddingSeatingTables = pgTable('wedding_seating_tables', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId: uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'set null' }),
  name:       varchar('name', { length: 100 }).notNull(),
  capacity:   integer('capacity').default(8).notNull(),
  shape:      tableShapeEnum('shape').default('ROUND').notNull(),
  notes:      text('notes'),
  posX:       integer('pos_x').default(0).notNull(),
  posY:       integer('pos_y').default(0).notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('seating_table_wedding_idx').on(t.weddingId),
  uniqueName: uniqueIndex('seating_table_unique_name').on(t.weddingId, t.ceremonyId, t.name),
}));

export const weddingSeatingAssignments = pgTable('wedding_seating_assignments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tableId:    uuid('table_id').notNull().references(() => weddingSeatingTables.id, { onDelete: 'cascade' }),
  guestId:    uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  seatNumber: integer('seat_number'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueGuest: uniqueIndex('seating_assign_unique_guest').on(t.tableId, t.guestId),
  tableIdx:    index('seating_assign_table_idx').on(t.tableId),
  guestIdx:    index('seating_assign_guest_idx').on(t.guestId),
}));

// ── Documents (contracts, receipts, permits) ────────────────────────────────

export const weddingDocuments = pgTable('wedding_documents', {
  id:          uuid('id').primaryKey().defaultRandom(),
  weddingId:   uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  type:        weddingDocumentTypeEnum('type').notNull(),
  label:       varchar('label', { length: 255 }).notNull(),
  r2Key:       varchar('r2_key', { length: 500 }).notNull(),
  fileSize:    integer('file_size'),
  mimeType:    varchar('mime_type', { length: 100 }),
  vendorId:    uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  expenseId:   uuid('expense_id').references(() => weddingExpenses.id, { onDelete: 'set null' }),
  uploadedBy:  text('uploaded_by').notNull().references(() => user.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('doc_wedding_idx').on(t.weddingId),
  typeIdx:    index('doc_type_idx').on(t.weddingId, t.type),
}));

// ── Mood Board ───────────────────────────────────────────────────────────────

export const weddingMoodBoardItems = pgTable('wedding_mood_board_items', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  r2Key:      varchar('r2_key', { length: 500 }).notNull(),
  caption:    varchar('caption', { length: 500 }),
  category:   moodBoardCategoryEnum('category').default('OTHER').notNull(),
  tags:       text('tags').array().default([]),
  sortOrder:  integer('sort_order').default(0).notNull(),
  uploadedBy: text('uploaded_by').references(() => user.id),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:  index('moodboard_wedding_idx').on(t.weddingId),
  categoryIdx: index('moodboard_category_idx').on(t.weddingId, t.category),
}));

// ── Activity Log (append-only) ───────────────────────────────────────────────

export const weddingActivityLog = pgTable('wedding_activity_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  actorId:    text('actor_id').references(() => user.id),
  action:     varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId:   uuid('entity_id'),
  payload:    jsonb('payload'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('activity_wedding_idx').on(t.weddingId, t.createdAt),
}));

// ── Member Invites (email-based) ─────────────────────────────────────────────

export const weddingMemberInvites = pgTable('wedding_member_invites', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  inviterId:  text('inviter_id').notNull().references(() => user.id),
  email:      varchar('email', { length: 255 }).notNull(),
  role:       weddingMemberRoleEnum('role').default('VIEWER').notNull(),
  token:      varchar('token', { length: 64 }).unique().notNull(),
  expiresAt:  timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('invite_wedding_idx').on(t.weddingId),
  emailIdx:   index('invite_email_idx').on(t.email),
}));

// ── Vendor Assignments (link vendor/booking to a wedding/ceremony) ──────────

export const weddingVendorAssignments = pgTable('wedding_vendor_assignments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId: uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'set null' }),
  vendorId:   uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  bookingId:  uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  role:       vendorAssignmentRoleEnum('role').notNull(),
  status:     vendorAssignmentStatusEnum('status').default('SHORTLISTED').notNull(),
  notes:      text('notes'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:    index('wva_wedding_idx').on(t.weddingId),
  uniqueBooking: uniqueIndex('wva_unique_booking').on(t.bookingId),
}));

// ── Task Comments + Attachments ──────────────────────────────────────────────

export const weddingTaskComments = pgTable('wedding_task_comments', {
  id:        uuid('id').primaryKey().defaultRandom(),
  taskId:    uuid('task_id').notNull().references(() => weddingTasks.id, { onDelete: 'cascade' }),
  authorId:  text('author_id').notNull().references(() => user.id),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  taskIdx: index('task_comment_task_idx').on(t.taskId),
}));

export const weddingTaskAttachments = pgTable('wedding_task_attachments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  taskId:     uuid('task_id').notNull().references(() => weddingTasks.id, { onDelete: 'cascade' }),
  r2Key:      varchar('r2_key', { length: 500 }).notNull(),
  fileName:   varchar('file_name', { length: 255 }).notNull(),
  mimeType:   varchar('mime_type', { length: 100 }),
  fileSize:   integer('file_size'),
  uploadedBy: text('uploaded_by').notNull().references(() => user.id),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  taskIdx: index('task_attach_task_idx').on(t.taskId),
}));

// ── Public Wedding Website ───────────────────────────────────────────────────

export const weddingWebsites = pgTable('wedding_websites', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').unique().notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  slug:         varchar('slug', { length: 80 }).unique().notNull(),
  title:        varchar('title', { length: 255 }).notNull(),
  story:        text('story'),
  heroImageKey: varchar('hero_image_key', { length: 500 }),
  theme:        jsonb('theme'),         // { primary, accent, font }
  sections:     jsonb('sections'),      // ordered list of { id, type, data }
  isPublic:     boolean('is_public').default(false).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  rsvpEnabled:  boolean('rsvp_enabled').default(true).notNull(),
  registryEnabled: boolean('registry_enabled').default(false).notNull(),
  customDomain: varchar('custom_domain', { length: 255 }),
  viewCount:    integer('view_count').default(0).notNull(),
  publishedAt:  timestamp('published_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

// ── Gift Registry ────────────────────────────────────────────────────────────

export const giftRegistryItems = pgTable('gift_registry_items', {
  id:            uuid('id').primaryKey().defaultRandom(),
  weddingId:     uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  label:         varchar('label', { length: 255 }).notNull(),
  description:   text('description'),
  price:         decimal('price', { precision: 12, scale: 2 }),
  currency:      varchar('currency', { length: 3 }).default('INR').notNull(),
  imageR2Key:    varchar('image_r2_key', { length: 500 }),
  externalUrl:   text('external_url'),
  status:        giftRegistryStatusEnum('status').default('AVAILABLE').notNull(),
  claimedBy:     text('claimed_by').references(() => user.id),
  claimedByName: varchar('claimed_by_name', { length: 255 }),
  claimedAt:     timestamp('claimed_at'),
  sortOrder:     integer('sort_order').default(0).notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('registry_wedding_idx').on(t.weddingId),
  statusIdx:  index('registry_status_idx').on(t.status),
}));

// ── Reminders (scheduled, processed by Bull queue) ───────────────────────────

export const weddingReminders = pgTable('wedding_reminders', {
  id:          uuid('id').primaryKey().defaultRandom(),
  weddingId:   uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId:  uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'cascade' }),
  type:        weddingReminderTypeEnum('type').notNull(),
  targetType:  varchar('target_type', { length: 50 }),
  targetId:    uuid('target_id'),
  channel:     varchar('channel', { length: 20 }).default('IN_APP').notNull(),  // IN_APP | EMAIL | SMS | WHATSAPP
  scheduledAt: timestamp('scheduled_at').notNull(),
  sentAt:      timestamp('sent_at'),
  failedAt:    timestamp('failed_at'),
  attemptCount: integer('attempt_count').default(0).notNull(),
  payload:     jsonb('payload'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:  index('reminder_wedding_idx').on(t.weddingId),
  ceremonyIdx: index('reminder_ceremony_idx').on(t.ceremonyId),
  scheduleIdx: index('reminder_schedule_idx').on(t.scheduledAt, t.sentAt),
}));

// ── Coordinator Assignments ──────────────────────────────────────────────────

export const weddingCoordinatorAssignments = pgTable('wedding_coordinator_assignments', {
  id:                uuid('id').primaryKey().defaultRandom(),
  weddingId:         uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  coordinatorUserId: text('coordinator_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  scope:             coordinatorScopeEnum('scope').default('FULL').notNull(),
  assignedBy:        text('assigned_by').references(() => user.id),
  assignedAt:        timestamp('assigned_at').defaultNow().notNull(),
  revokedAt:         timestamp('revoked_at'),
  notes:             text('notes'),
}, (t) => ({
  uniqueAssignment: uniqueIndex('coordinator_unique_assignment').on(t.weddingId, t.coordinatorUserId),
  weddingIdx:       index('coordinator_wedding_idx').on(t.weddingId),
  userIdx:          index('coordinator_user_idx').on(t.coordinatorUserId),
}));

// ── Per-ceremony Guest Invitations (junction) ────────────────────────────────

export const guestCeremonyInvites = pgTable('guest_ceremony_invites', {
  id:           uuid('id').primaryKey().defaultRandom(),
  guestId:      uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  ceremonyId:   uuid('ceremony_id').notNull().references(() => ceremonies.id, { onDelete: 'cascade' }),
  rsvpStatus:   varchar('rsvp_status', { length: 20 }).default('PENDING').notNull(),  // PENDING|YES|NO|MAYBE
  plusOnes:     integer('plus_ones').default(0).notNull(),
  mealPref:     varchar('meal_pref', { length: 20 }),
  respondedAt:  timestamp('responded_at'),
  invitedAt:    timestamp('invited_at').defaultNow().notNull(),
  notes:        text('notes'),
}, (t) => ({
  uniqueGuestCeremony: uniqueIndex('gci_unique_guest_ceremony').on(t.guestId, t.ceremonyId),
  guestIdx:            index('gci_guest_idx').on(t.guestId),
  ceremonyIdx:         index('gci_ceremony_idx').on(t.ceremonyId),
  ceremonyRsvpIdx:     index('gci_ceremony_rsvp_idx').on(t.ceremonyId, t.rsvpStatus),
}));

// ── Day-of Incidents ─────────────────────────────────────────────────────────

export const weddingIncidents = pgTable('wedding_incidents', {
  id:          uuid('id').primaryKey().defaultRandom(),
  weddingId:   uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  ceremonyId:  uuid('ceremony_id').references(() => ceremonies.id, { onDelete: 'set null' }),
  severity:    incidentSeverityEnum('severity').default('LOW').notNull(),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  reportedBy:  text('reported_by').references(() => user.id),
  resolvedBy:  text('resolved_by').references(() => user.id),
  resolvedAt:  timestamp('resolved_at'),
  resolution:  text('resolution'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx:  index('incident_wedding_idx').on(t.weddingId),
  ceremonyIdx: index('incident_ceremony_idx').on(t.ceremonyId),
  severityIdx: index('incident_severity_idx').on(t.weddingId, t.severity),
  openIdx:     index('incident_open_idx').on(t.weddingId, t.resolvedAt),
}));

// ── Public RSVP Tokens (public token-based RSVP for guests w/o login) ────────

export const rsvpTokens = pgTable('rsvp_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  guestId:   uuid('guest_id').unique().notNull().references(() => guests.id, { onDelete: 'cascade' }),
  token:     varchar('token', { length: 64 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt:    timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Custom RSVP Questions (per-wedding, owner-defined) ───────────────────────

export const rsvpQuestionTypeEnum = pgEnum('rsvp_question_type', ['TEXT', 'BOOLEAN', 'CHOICE']);

export const rsvpCustomQuestions = pgTable('rsvp_custom_questions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  questionText: varchar('question_text', { length: 500 }).notNull(),
  questionType: rsvpQuestionTypeEnum('question_type').default('TEXT').notNull(),
  choices:      jsonb('choices'),                       // string[] for CHOICE type
  isRequired:   boolean('is_required').default(false).notNull(),
  sortOrder:    integer('sort_order').default(0).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('rsvp_q_wedding_idx').on(t.weddingId, t.sortOrder),
}));

export const rsvpCustomAnswers = pgTable('rsvp_custom_answers', {
  id:         uuid('id').primaryKey().defaultRandom(),
  guestId:    uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => rsvpCustomQuestions.id, { onDelete: 'cascade' }),
  answerText: text('answer_text'),
  answerBool: boolean('answer_bool'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueAns: uniqueIndex('rsvp_a_unique').on(t.guestId, t.questionId),
  guestIdx:  index('rsvp_a_guest_idx').on(t.guestId),
}));

// ── Guest Mailing Address (for physical invitations) ─────────────────────────

export const guestAddresses = pgTable('guest_addresses', {
  id:        uuid('id').primaryKey().defaultRandom(),
  guestId:   uuid('guest_id').unique().notNull().references(() => guests.id, { onDelete: 'cascade' }),
  line1:     varchar('line1', { length: 255 }),
  line2:     varchar('line2', { length: 255 }),
  city:      varchar('city',  { length: 100 }),
  state:     varchar('state', { length: 100 }),
  pincode:   varchar('pincode', { length: 10 }),
  country:   varchar('country', { length: 50 }).default('India').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── RSVP Deadline (per wedding, drives reminder jobs + enforcement) ──────────

export const rsvpDeadlines = pgTable('rsvp_deadlines', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').unique().notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  deadline:     timestamp('deadline').notNull(),
  enforced:     boolean('enforced').default(false).notNull(),
  reminderDays: integer('reminder_days').array().default([7, 3, 1]),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

// ── Invitation Batches (preview-then-send tracking) ──────────────────────────

export const invitationBatches = pgTable('invitation_batches', {
  id:          uuid('id').primaryKey().defaultRandom(),
  weddingId:   uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  channel:     varchar('channel', { length: 20 }).notNull(),
  type:        varchar('type', { length: 20 }).default('INVITATION').notNull(),
  guestIds:    jsonb('guest_ids').notNull(),         // string[] of guest UUIDs
  previewedAt: timestamp('previewed_at').defaultNow().notNull(),
  sentAt:      timestamp('sent_at'),
  sentBy:      text('sent_by').references(() => user.id, { onDelete: 'set null' }),
  sentCount:   integer('sent_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
}, (t) => ({
  weddingIdx: index('inv_batch_wedding_idx').on(t.weddingId),
}));

// ── Relations ────────────────────────────────────────────────────────────────

export const weddingExpensesRelations = relations(weddingExpenses, ({ one }) => ({
  wedding: one(weddings, { fields: [weddingExpenses.weddingId], references: [weddings.id] }),
  vendor:  one(vendors,  { fields: [weddingExpenses.vendorId],  references: [vendors.id] }),
  booking: one(bookings, { fields: [weddingExpenses.bookingId], references: [bookings.id] }),
  creator: one(user,     { fields: [weddingExpenses.createdBy], references: [user.id] }),
}));

export const weddingTimelineEventsRelations = relations(weddingTimelineEvents, ({ one }) => ({
  wedding:  one(weddings,   { fields: [weddingTimelineEvents.weddingId],  references: [weddings.id] }),
  ceremony: one(ceremonies, { fields: [weddingTimelineEvents.ceremonyId], references: [ceremonies.id] }),
  assignee: one(user,       { fields: [weddingTimelineEvents.assignedTo], references: [user.id] }),
  vendor:   one(vendors,    { fields: [weddingTimelineEvents.vendorId],   references: [vendors.id] }),
}));

export const weddingSeatingTablesRelations = relations(weddingSeatingTables, ({ one, many }) => ({
  wedding:     one(weddings,   { fields: [weddingSeatingTables.weddingId],  references: [weddings.id] }),
  ceremony:    one(ceremonies, { fields: [weddingSeatingTables.ceremonyId], references: [ceremonies.id] }),
  assignments: many(weddingSeatingAssignments),
}));

export const weddingSeatingAssignmentsRelations = relations(weddingSeatingAssignments, ({ one }) => ({
  table: one(weddingSeatingTables, { fields: [weddingSeatingAssignments.tableId], references: [weddingSeatingTables.id] }),
  guest: one(guests,                { fields: [weddingSeatingAssignments.guestId], references: [guests.id] }),
}));

export const weddingDocumentsRelations = relations(weddingDocuments, ({ one }) => ({
  wedding:  one(weddings, { fields: [weddingDocuments.weddingId], references: [weddings.id] }),
  vendor:   one(vendors,  { fields: [weddingDocuments.vendorId],  references: [vendors.id] }),
  expense:  one(weddingExpenses, { fields: [weddingDocuments.expenseId], references: [weddingExpenses.id] }),
  uploader: one(user,     { fields: [weddingDocuments.uploadedBy], references: [user.id] }),
}));

export const weddingVendorAssignmentsRelations = relations(weddingVendorAssignments, ({ one }) => ({
  wedding:  one(weddings,   { fields: [weddingVendorAssignments.weddingId],  references: [weddings.id] }),
  ceremony: one(ceremonies, { fields: [weddingVendorAssignments.ceremonyId], references: [ceremonies.id] }),
  vendor:   one(vendors,    { fields: [weddingVendorAssignments.vendorId],   references: [vendors.id] }),
  booking:  one(bookings,   { fields: [weddingVendorAssignments.bookingId],  references: [bookings.id] }),
}));

export const weddingMemberInvitesRelations = relations(weddingMemberInvites, ({ one }) => ({
  wedding: one(weddings, { fields: [weddingMemberInvites.weddingId], references: [weddings.id] }),
  inviter: one(user,     { fields: [weddingMemberInvites.inviterId], references: [user.id] }),
}));

export const weddingTaskCommentsRelations = relations(weddingTaskComments, ({ one }) => ({
  task:   one(weddingTasks, { fields: [weddingTaskComments.taskId],   references: [weddingTasks.id] }),
  author: one(user,         { fields: [weddingTaskComments.authorId], references: [user.id] }),
}));

export const weddingTaskAttachmentsRelations = relations(weddingTaskAttachments, ({ one }) => ({
  task:     one(weddingTasks, { fields: [weddingTaskAttachments.taskId],     references: [weddingTasks.id] }),
  uploader: one(user,         { fields: [weddingTaskAttachments.uploadedBy], references: [user.id] }),
}));

export const weddingMoodBoardItemsRelations = relations(weddingMoodBoardItems, ({ one }) => ({
  wedding:  one(weddings, { fields: [weddingMoodBoardItems.weddingId],  references: [weddings.id] }),
  uploader: one(user,     { fields: [weddingMoodBoardItems.uploadedBy], references: [user.id] }),
}));

export const weddingActivityLogRelations = relations(weddingActivityLog, ({ one }) => ({
  wedding: one(weddings, { fields: [weddingActivityLog.weddingId], references: [weddings.id] }),
  actor:   one(user,     { fields: [weddingActivityLog.actorId],   references: [user.id] }),
}));

export const weddingWebsitesRelations = relations(weddingWebsites, ({ one }) => ({
  wedding: one(weddings, { fields: [weddingWebsites.weddingId], references: [weddings.id] }),
}));

export const giftRegistryItemsRelations = relations(giftRegistryItems, ({ one }) => ({
  wedding:  one(weddings, { fields: [giftRegistryItems.weddingId], references: [weddings.id] }),
  claimer:  one(user,     { fields: [giftRegistryItems.claimedBy], references: [user.id] }),
}));

export const rsvpTokensRelations = relations(rsvpTokens, ({ one }) => ({
  guest: one(guests, { fields: [rsvpTokens.guestId], references: [guests.id] }),
}));

export const weddingCoordinatorAssignmentsRelations = relations(weddingCoordinatorAssignments, ({ one }) => ({
  wedding:     one(weddings, { fields: [weddingCoordinatorAssignments.weddingId],         references: [weddings.id] }),
  coordinator: one(user,     { fields: [weddingCoordinatorAssignments.coordinatorUserId], references: [user.id] }),
  assigner:    one(user,     { fields: [weddingCoordinatorAssignments.assignedBy],        references: [user.id] }),
}));

export const guestCeremonyInvitesRelations = relations(guestCeremonyInvites, ({ one }) => ({
  guest:    one(guests,     { fields: [guestCeremonyInvites.guestId],    references: [guests.id] }),
  ceremony: one(ceremonies, { fields: [guestCeremonyInvites.ceremonyId], references: [ceremonies.id] }),
}));

export const weddingIncidentsRelations = relations(weddingIncidents, ({ one }) => ({
  wedding:  one(weddings,   { fields: [weddingIncidents.weddingId],  references: [weddings.id] }),
  ceremony: one(ceremonies, { fields: [weddingIncidents.ceremonyId], references: [ceremonies.id] }),
  reporter: one(user,       { fields: [weddingIncidents.reportedBy], references: [user.id] }),
  resolver: one(user,       { fields: [weddingIncidents.resolvedBy], references: [user.id] }),
}));

export const weddingRemindersRelations = relations(weddingReminders, ({ one }) => ({
  wedding:  one(weddings,   { fields: [weddingReminders.weddingId],  references: [weddings.id] }),
  ceremony: one(ceremonies, { fields: [weddingReminders.ceremonyId], references: [ceremonies.id] }),
}));

export const rsvpCustomQuestionsRelations = relations(rsvpCustomQuestions, ({ one, many }) => ({
  wedding: one(weddings, { fields: [rsvpCustomQuestions.weddingId], references: [weddings.id] }),
  answers: many(rsvpCustomAnswers),
}));

export const rsvpCustomAnswersRelations = relations(rsvpCustomAnswers, ({ one }) => ({
  guest:    one(guests, { fields: [rsvpCustomAnswers.guestId], references: [guests.id] }),
  question: one(rsvpCustomQuestions, { fields: [rsvpCustomAnswers.questionId], references: [rsvpCustomQuestions.id] }),
}));

export const guestAddressesRelations = relations(guestAddresses, ({ one }) => ({
  guest: one(guests, { fields: [guestAddresses.guestId], references: [guests.id] }),
}));

export const rsvpDeadlinesRelations = relations(rsvpDeadlines, ({ one }) => ({
  wedding: one(weddings, { fields: [rsvpDeadlines.weddingId], references: [weddings.id] }),
}));

export const invitationBatchesRelations = relations(invitationBatches, ({ one }) => ({
  wedding: one(weddings, { fields: [invitationBatches.weddingId], references: [weddings.id] }),
  sender:  one(user,     { fields: [invitationBatches.sentBy],    references: [user.id] }),
}));
