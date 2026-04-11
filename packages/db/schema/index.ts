/**
 * Smart Shaadi — PostgreSQL Schema (Drizzle ORM)
 * packages/db/schema/index.ts
 *
 * This is the complete Phase 1 schema.
 * Phase 2+ additions are in separate files: schema/phase2.ts etc.
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, date, integer, decimal, jsonb, inet,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── ENUMS ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'INDIVIDUAL',
  'FAMILY_MEMBER',
  'VENDOR',
  'EVENT_COORDINATOR',
  'ADMIN',
  'SUPPORT',
]);

export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
  'DELETED',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'MANUAL_REVIEW',
]);

export const premiumTierEnum = pgEnum('premium_tier', [
  'FREE',
  'STANDARD',
  'PREMIUM',
]);

export const otpPurposeEnum = pgEnum('otp_purpose', [
  'LOGIN',
  'REGISTRATION',
  'KYC',
  'CONTACT_UNLOCK',
  'PASSWORD_RESET',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN',
  'BLOCKED',
  'EXPIRED',
]);

export const vendorCategoryEnum = pgEnum('vendor_category', [
  'PHOTOGRAPHY',
  'VIDEOGRAPHY',
  'CATERING',
  'DECORATION',
  'VENUE',
  'MAKEUP',
  'JEWELLERY',
  'CLOTHING',
  'MUSIC',
  'LIGHTING',
  'SECURITY',
  'TRANSPORT',
  'PRIEST',
  'SOUND',
  'EVENT_HOSTING',
  'RENTAL',
  'OTHER',
]);

export const ceremonyTypeEnum = pgEnum('ceremony_type', [
  'WEDDING',
  'HALDI',
  'MEHNDI',
  'SANGEET',
  'ENGAGEMENT',
  'RECEPTION',
  'CORPORATE',
  'FESTIVAL',
  'COMMUNITY',
  'GOVERNMENT',
  'SCHOOL',
  'OTHER',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'UPI',
  'CARD',
  'NETBANKING',
  'WALLET',
  'EMI',
  'CASH',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export const escrowStatusEnum = pgEnum('escrow_status', [
  'HELD',
  'RELEASED',
  'DISPUTED',
  'REFUNDED',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'NEW_MATCH',
  'MATCH_ACCEPTED',
  'MATCH_DECLINED',
  'NEW_MESSAGE',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'ESCROW_RELEASED',
  'RSVP_RECEIVED',
  'TASK_DUE',
  'SYSTEM',
]);

export const weddingStatusEnum = pgEnum('wedding_status', [
  'PLANNING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

export const rsvpStatusEnum = pgEnum('rsvp_status', [
  'PENDING',
  'YES',
  'NO',
  'MAYBE',
]);

export const mealPrefEnum = pgEnum('meal_preference', [
  'VEG',
  'NON_VEG',
  'JAIN',
  'VEGAN',
  'EGGETARIAN',
  'NO_PREFERENCE',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'USER_REGISTERED',
  'USER_VERIFIED',
  'USER_SUSPENDED',
  'KYC_SUBMITTED',
  'KYC_VERIFIED',
  'KYC_REJECTED',
  'MATCH_ACCEPTED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'ESCROW_HELD',
  'ESCROW_RELEASED',
  'ESCROW_DISPUTED',
  'CONTRACT_SIGNED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'VENDOR_APPROVED',
  'PROFILE_BLOCKED',
]);

// ── TABLES ───────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  phone:        varchar('phone', { length: 15 }).unique().notNull(),
  email:        varchar('email', { length: 255 }).unique(),
  role:         userRoleEnum('role').notNull().default('INDIVIDUAL'),
  status:       userStatusEnum('status').notNull().default('ACTIVE'),
  verifiedAt:   timestamp('verified_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  phoneIdx: index('users_phone_idx').on(t.phone),
  emailIdx: index('users_email_idx').on(t.email),
}));

export const sessions = pgTable('sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash:    varchar('token_hash', { length: 64 }).unique().notNull(),
  device:       varchar('device', { length: 255 }),
  ipAddress:    inet('ip_address'),
  expiresAt:    timestamp('expires_at').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
  tokenIdx: index('sessions_token_idx').on(t.tokenHash),
}));

export const otpVerifications = pgTable('otp_verifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  phone:      varchar('phone', { length: 15 }).notNull(),
  otpHash:    varchar('otp_hash', { length: 64 }).notNull(),
  purpose:    otpPurposeEnum('purpose').notNull(),
  attempts:   integer('attempts').default(0),
  expiresAt:  timestamp('expires_at').notNull(),
  usedAt:     timestamp('used_at'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  phoneIdx: index('otp_phone_idx').on(t.phone),
}));

// ── Profiles ──────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').unique().notNull().references(() => users.id),
  mongoProfileId:       varchar('mongo_profile_id', { length: 24 }),
  verificationStatus:   verificationStatusEnum('verification_status').default('PENDING').notNull(),
  premiumTier:          premiumTierEnum('premium_tier').default('FREE').notNull(),
  profileCompleteness:  integer('profile_completeness').default(0), // 0-100
  isActive:             boolean('is_active').default(true).notNull(),
  lastActiveAt:         timestamp('last_active_at'),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  updatedAt:            timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('profiles_user_idx').on(t.userId),
  statusIdx: index('profiles_status_idx').on(t.verificationStatus),
}));

export const profilePhotos = pgTable('profile_photos', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profileId:    uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  r2Key:        varchar('r2_key', { length: 500 }).notNull(),
  isPrimary:    boolean('is_primary').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  uploadedAt:   timestamp('uploaded_at').defaultNow().notNull(),
}, (t) => ({
  profileIdx: index('photos_profile_idx').on(t.profileId),
}));

export const communityZones = pgTable('community_zones', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileId:      uuid('profile_id').unique().notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  community:      varchar('community', { length: 100 }),      // e.g., 'Rajput', 'Brahmin', 'Jain'
  subCommunity:   varchar('sub_community', { length: 100 }),
  language:       varchar('language', { length: 50 }),        // primary language preference
  lgbtqProfile:   boolean('lgbtq_profile').default(false),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

// ── KYC ─────────────────────────────────────────────────────────────────────

export const kycVerifications = pgTable('kyc_verifications', {
  id:               uuid('id').primaryKey().defaultRandom(),
  profileId:        uuid('profile_id').unique().notNull()
                      .references(() => profiles.id, { onDelete: 'cascade' }),
  aadhaarVerified:  boolean('aadhaar_verified').default(false).notNull(),
  aadhaarRefId:     varchar('aadhaar_ref_id', { length: 100 }),   // DigiLocker ref, never Aadhaar number
  photoAnalysis:    jsonb('photo_analysis'),                        // PhotoAnalysis JSON
  duplicateFlag:    boolean('duplicate_flag').default(false).notNull(),
  duplicateReason:  text('duplicate_reason'),
  adminNote:        text('admin_note'),
  reviewedBy:       uuid('reviewed_by').references(() => users.id),
  reviewedAt:       timestamp('reviewed_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
});

// ── Matchmaking ───────────────────────────────────────────────────────────────

export const matchRequests = pgTable('match_requests', {
  id:           uuid('id').primaryKey().defaultRandom(),
  senderId:     uuid('sender_id').notNull().references(() => profiles.id),
  receiverId:   uuid('receiver_id').notNull().references(() => profiles.id),
  status:       matchStatusEnum('status').default('PENDING').notNull(),
  message:      text('message'),
  respondedAt:  timestamp('responded_at'),
  expiresAt:    timestamp('expires_at'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  senderIdx:    index('match_sender_idx').on(t.senderId),
  receiverIdx:  index('match_receiver_idx').on(t.receiverId),
  uniquePair:   uniqueIndex('match_unique_pair').on(t.senderId, t.receiverId),
}));

export const matchScores = pgTable('match_scores', {
  id:             uuid('id').primaryKey().defaultRandom(),
  profileA:       uuid('profile_a').notNull().references(() => profiles.id),
  profileB:       uuid('profile_b').notNull().references(() => profiles.id),
  totalScore:     integer('total_score').notNull(),    // 0-100
  breakdown:      jsonb('breakdown'),                  // per-dimension scores
  gunaMilanScore: integer('guna_milan_score'),         // 0-36
  computedAt:     timestamp('computed_at').defaultNow().notNull(),
}, (t) => ({
  pairIdx: uniqueIndex('score_pair_idx').on(t.profileA, t.profileB),
}));

export const blockedUsers = pgTable('blocked_users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  blockerId:  uuid('blocker_id').notNull().references(() => profiles.id),
  blockedId:  uuid('blocked_id').notNull().references(() => profiles.id),
  reason:     text('reason'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueBlock: uniqueIndex('unique_block').on(t.blockerId, t.blockedId),
}));

// ── Vendors ───────────────────────────────────────────────────────────────────

export const vendors = pgTable('vendors', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').unique().notNull().references(() => users.id),
  mongoPortfolioId: varchar('mongo_portfolio_id', { length: 24 }),
  businessName:   varchar('business_name', { length: 255 }).notNull(),
  category:       vendorCategoryEnum('category').notNull(),
  city:           varchar('city', { length: 100 }).notNull(),
  state:          varchar('state', { length: 100 }).notNull(),
  verified:       boolean('verified').default(false).notNull(),
  rating:         decimal('rating', { precision: 3, scale: 2 }).default('0'),
  totalReviews:   integer('total_reviews').default(0).notNull(),
  isActive:       boolean('is_active').default(true).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  cityIdx:      index('vendor_city_idx').on(t.city),
  categoryIdx:  index('vendor_category_idx').on(t.category),
}));

export const vendorServices = pgTable('vendor_services', {
  id:           uuid('id').primaryKey().defaultRandom(),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 255 }).notNull(),
  description:  text('description'),
  priceFrom:    decimal('price_from', { precision: 12, scale: 2 }),
  priceTo:      decimal('price_to', { precision: 12, scale: 2 }),
  priceUnit:    varchar('price_unit', { length: 50 }),   // PER_EVENT | PER_HOUR | PER_PERSON
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const vendorEventTypes = pgTable('vendor_event_types', {
  id:         uuid('id').primaryKey().defaultRandom(),
  vendorId:   uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  eventType:  ceremonyTypeEnum('event_type').notNull(),
  available:  boolean('available').default(true).notNull(),
}, (t) => ({
  uniqueVendorEvent: uniqueIndex('unique_vendor_event').on(t.vendorId, t.eventType),
}));

// ── Bookings ──────────────────────────────────────────────────────────────────

export const bookings = pgTable('bookings', {
  id:             uuid('id').primaryKey().defaultRandom(),
  customerId:     uuid('customer_id').notNull().references(() => users.id),
  vendorId:       uuid('vendor_id').notNull().references(() => vendors.id),
  serviceId:      uuid('service_id').references(() => vendorServices.id),
  eventDate:      date('event_date').notNull(),
  ceremonyType:   ceremonyTypeEnum('ceremony_type').notNull().default('WEDDING'),
  status:         bookingStatusEnum('status').default('PENDING').notNull(),
  totalAmount:    decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  notes:          text('notes'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx:  index('booking_customer_idx').on(t.customerId),
  vendorIdx:    index('booking_vendor_idx').on(t.vendorId),
  dateIdx:      index('booking_date_idx').on(t.eventDate),
}));

// ── Payments ──────────────────────────────────────────────────────────────────

export const payments = pgTable('payments', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  bookingId:            uuid('booking_id').notNull().references(() => bookings.id),
  amount:               decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:             varchar('currency', { length: 3 }).default('INR').notNull(),
  method:               paymentMethodEnum('method'),
  status:               paymentStatusEnum('status').default('PENDING').notNull(),
  razorpayOrderId:      varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId:    varchar('razorpay_payment_id', { length: 255 }),
  razorpaySignature:    varchar('razorpay_signature', { length: 500 }),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  settledAt:            timestamp('settled_at'),
}, (t) => ({
  bookingIdx: index('payment_booking_idx').on(t.bookingId),
  statusIdx:  index('payment_status_idx').on(t.status),
}));

export const escrowAccounts = pgTable('escrow_accounts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  bookingId:        uuid('booking_id').unique().notNull().references(() => bookings.id),
  totalHeld:        decimal('total_held', { precision: 12, scale: 2 }).notNull(),
  released:         decimal('released', { precision: 12, scale: 2 }).default('0').notNull(),
  status:           escrowStatusEnum('status').default('HELD').notNull(),
  releaseDueAt:     timestamp('release_due_at'),     // 48h after event completion
  releasedAt:       timestamp('released_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
});

// ── Audit Log (IMMUTABLE — never update or delete) ────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  eventType:    auditEventTypeEnum('event_type').notNull(),
  entityType:   varchar('entity_type', { length: 50 }).notNull(),
  entityId:     uuid('entity_id').notNull(),
  actorId:      uuid('actor_id').references(() => users.id),
  payload:      jsonb('payload'),
  contentHash:  varchar('content_hash', { length: 64 }).notNull(),
  prevHash:     varchar('prev_hash', { length: 64 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  // NO updatedAt — this table is append-only
}, (t) => ({
  entityIdx:  index('audit_entity_idx').on(t.entityType, t.entityId),
  actorIdx:   index('audit_actor_idx').on(t.actorId),
  createdIdx: index('audit_created_idx').on(t.createdAt),
}));

// ── Weddings ──────────────────────────────────────────────────────────────────

export const weddings = pgTable('weddings', {
  id:               uuid('id').primaryKey().defaultRandom(),
  profileId:        uuid('profile_id').notNull().references(() => profiles.id),
  mongoWeddingPlanId: varchar('mongo_wedding_plan_id', { length: 24 }),
  weddingDate:      date('wedding_date'),
  venueName:        varchar('venue_name', { length: 255 }),
  venueCity:        varchar('venue_city', { length: 100 }),
  budgetTotal:      decimal('budget_total', { precision: 12, scale: 2 }),
  guestCount:       integer('guest_count'),
  status:           weddingStatusEnum('status').default('PLANNING').notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
});

export const weddingMembers = pgTable('wedding_members', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').notNull().references(() => users.id),
  role:         varchar('role', { length: 50 }).default('VIEWER').notNull(),  // VIEWER | EDITOR | OWNER
  invitedAt:    timestamp('invited_at').defaultNow().notNull(),
  acceptedAt:   timestamp('accepted_at'),
}, (t) => ({
  uniqueMember: uniqueIndex('unique_wedding_member').on(t.weddingId, t.userId),
}));

export const weddingTasks = pgTable('wedding_tasks', {
  id:           uuid('id').primaryKey().defaultRandom(),
  weddingId:    uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  title:        varchar('title', { length: 255 }).notNull(),
  description:  text('description'),
  dueDate:      date('due_date'),
  status:       varchar('status', { length: 20 }).default('TODO').notNull(), // TODO | IN_PROGRESS | DONE
  priority:     varchar('priority', { length: 10 }).default('MEDIUM').notNull(), // LOW | MEDIUM | HIGH
  assignedTo:   uuid('assigned_to').references(() => users.id),
  category:     varchar('category', { length: 50 }),  // Venue | Catering | etc.
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  weddingIdx: index('task_wedding_idx').on(t.weddingId),
  statusIdx:  index('task_status_idx').on(t.status),
}));

// ── Guests ────────────────────────────────────────────────────────────────────

export const guestLists = pgTable('guest_lists', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').unique().notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  createdBy:  uuid('created_by').notNull().references(() => users.id),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
});

export const guests = pgTable('guests', {
  id:               uuid('id').primaryKey().defaultRandom(),
  guestListId:      uuid('guest_list_id').notNull().references(() => guestLists.id, { onDelete: 'cascade' }),
  name:             varchar('name', { length: 255 }).notNull(),
  phone:            varchar('phone', { length: 15 }),
  email:            varchar('email', { length: 255 }),
  relationship:     varchar('relationship', { length: 100 }),
  side:             varchar('side', { length: 10 }),         // BRIDE | GROOM | BOTH
  rsvpStatus:       rsvpStatusEnum('rsvp_status').default('PENDING').notNull(),
  mealPreference:   mealPrefEnum('meal_preference').default('NO_PREFERENCE').notNull(),
  roomNumber:       varchar('room_number', { length: 20 }),
  plusOnes:         integer('plus_ones').default(0).notNull(),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  listIdx: index('guest_list_idx').on(t.guestListId),
}));

export const invitations = pgTable('invitations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  guestId:      uuid('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  sentAt:       timestamp('sent_at').defaultNow().notNull(),
  channel:      varchar('channel', { length: 20 }).notNull(),  // EMAIL | SMS | WHATSAPP
  openedAt:     timestamp('opened_at'),
  rsvpAt:       timestamp('rsvp_at'),
  messageId:    varchar('message_id', { length: 255 }),  // provider message ID
});

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:       notificationTypeEnum('type').notNull(),
  title:      varchar('title', { length: 255 }).notNull(),
  body:       text('body').notNull(),
  data:       jsonb('data'),
  read:       boolean('read').default(false).notNull(),
  sentVia:    text('sent_via').array(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx:  index('notif_user_idx').on(t.userId),
  readIdx:  index('notif_read_idx').on(t.userId, t.read),
}));

export const notificationPreferences = pgTable('notification_preferences', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  push:       boolean('push').default(true).notNull(),
  sms:        boolean('sms').default(true).notNull(),
  email:      boolean('email').default(true).notNull(),
  inApp:      boolean('in_app').default(true).notNull(),
  marketing:  boolean('marketing').default(false).notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});


// ── E-Commerce ────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum('order_status', [
  'PLACED',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const products = pgTable('products', {
  id:               uuid('id').primaryKey().defaultRandom(),
  vendorId:         uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:             varchar('name', { length: 255 }).notNull(),
  description:      text('description'),
  category:         varchar('category', { length: 100 }).notNull(),
  price:            decimal('price', { precision: 12, scale: 2 }).notNull(),
  comparePrice:     decimal('compare_price', { precision: 12, scale: 2 }),
  stockQty:         integer('stock_qty').default(0).notNull(),
  sku:              varchar('sku', { length: 100 }),
  r2ImageKeys:      text('r2_image_keys').array(),
  isActive:         boolean('is_active').default(true).notNull(),
  isFeatured:       boolean('is_featured').default(false).notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:    index('product_vendor_idx').on(t.vendorId),
  categoryIdx:  index('product_category_idx').on(t.category),
  activeIdx:    index('product_active_idx').on(t.isActive),
}));

export const orders = pgTable('orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  customerId:           uuid('customer_id').notNull().references(() => users.id),
  status:               orderStatusEnum('status').default('PLACED').notNull(),
  subtotal:             decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  shippingFee:          decimal('shipping_fee', { precision: 12, scale: 2 }).default('0').notNull(),
  total:                decimal('total', { precision: 12, scale: 2 }).notNull(),
  shippingAddress:      jsonb('shipping_address').notNull(),
  razorpayOrderId:      varchar('razorpay_order_id', { length: 255 }),
  razorpayPaymentId:    varchar('razorpay_payment_id', { length: 255 }),
  notes:                text('notes'),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  updatedAt:            timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx:  index('order_customer_idx').on(t.customerId),
  statusIdx:    index('order_status_idx').on(t.status),
}));

export const orderItems = pgTable('order_items', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  orderId:            uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId:          uuid('product_id').notNull().references(() => products.id),
  vendorId:           uuid('vendor_id').notNull().references(() => vendors.id),
  quantity:           integer('quantity').notNull(),
  unitPrice:          decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal:           decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  fulfilmentStatus:   varchar('fulfilment_status', { length: 20 }).default('PENDING').notNull(),
  trackingNumber:     varchar('tracking_number', { length: 255 }),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  orderIdx:   index('order_item_order_idx').on(t.orderId),
  vendorIdx:  index('order_item_vendor_idx').on(t.vendorId),
}));

// ── RELATIONS ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  profile:    one(profiles, { fields: [users.id], references: [profiles.userId] }),
  vendor:     one(vendors,  { fields: [users.id], references: [vendors.userId] }),
  sessions:   many(sessions),
  notifications: many(notifications),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user:             one(users,        { fields: [profiles.userId], references: [users.id] }),
  photos:           many(profilePhotos),
  communityZone:    one(communityZones, { fields: [profiles.id], references: [communityZones.profileId] }),
  kycVerification:  one(kycVerifications, { fields: [profiles.id], references: [kycVerifications.profileId] }),
  sentRequests:     many(matchRequests, { relationName: 'sender' }),
  receivedRequests: many(matchRequests, { relationName: 'receiver' }),
  weddings:         many(weddings),
}));

export const kycVerificationsRelations = relations(kycVerifications, ({ one }) => ({
  profile:  one(profiles,  { fields: [kycVerifications.profileId],  references: [profiles.id] }),
  reviewer: one(users,     { fields: [kycVerifications.reviewedBy], references: [users.id] }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user:       one(users,         { fields: [vendors.userId], references: [users.id] }),
  services:   many(vendorServices),
  eventTypes: many(vendorEventTypes),
  bookings:   many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  customer:   one(users,    { fields: [bookings.customerId], references: [users.id] }),
  vendor:     one(vendors,  { fields: [bookings.vendorId],   references: [vendors.id] }),
  service:    one(vendorServices, { fields: [bookings.serviceId], references: [vendorServices.id] }),
  payment:    one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  escrow:     one(escrowAccounts, { fields: [bookings.id], references: [escrowAccounts.bookingId] }),
}));

export const weddingsRelations = relations(weddings, ({ one, many }) => ({
  profile:    one(profiles, { fields: [weddings.profileId], references: [profiles.id] }),
  members:    many(weddingMembers),
  tasks:      many(weddingTasks),
  guestList:  one(guestLists, { fields: [weddings.id], references: [guestLists.weddingId] }),
}));
