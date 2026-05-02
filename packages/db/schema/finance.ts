/**
 * Smart Shaadi — Finance Schema
 * packages/db/schema/finance.ts
 *
 * World-class payment infrastructure additions:
 *   - webhookEvents          dedup + audit raw webhook traffic
 *   - refunds                first-class refund records (partial supported)
 *   - invoices + sequence    GST-compliant sequential invoicing
 *   - payouts                vendor settlement records
 *   - wallets + ledger       internal credit balance per user
 *   - promoCodes + redemps   discount codes
 *   - paymentLinks           shareable Razorpay-backed links
 *   - paymentMethods         saved/tokenised payment instruments
 */

import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, integer, decimal, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { bookings, payments, escrowAccounts, vendors, orders } from './index';

// ── ENUMS ─────────────────────────────────────────────────────────────────────

export const refundStatusEnum = pgEnum('refund_status', [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
]);

export const refundReasonEnum = pgEnum('refund_reason', [
  'CUSTOMER_REQUEST',
  'SERVICE_CANCELLED',
  'VENDOR_NO_SHOW',
  'DUPLICATE_PAYMENT',
  'DISPUTE_RESOLVED',
  'FRAUD',
  'OTHER',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT',
  'ISSUED',
  'PAID',
  'CANCELLED',
  'CREDITED',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'SCHEDULED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'ON_HOLD',
]);

export const walletTxnTypeEnum = pgEnum('wallet_txn_type', [
  'CREDIT',
  'DEBIT',
]);

export const walletTxnReasonEnum = pgEnum('wallet_txn_reason', [
  'REFUND',
  'PROMO',
  'REFERRAL',
  'CASHBACK',
  'PAYMENT',
  'TOPUP',
  'ADJUSTMENT',
  'EXPIRY',
]);

export const promoTypeEnum = pgEnum('promo_type', ['PERCENT', 'FLAT']);

export const promoScopeEnum = pgEnum('promo_scope', [
  'BOOKING',
  'STORE',
  'WEDDING',
  'ALL',
]);

export const paymentLinkStatusEnum = pgEnum('payment_link_status', [
  'ACTIVE',
  'PAID',
  'EXPIRED',
  'CANCELLED',
]);

export const webhookEventStatusEnum = pgEnum('webhook_event_status', [
  'RECEIVED',
  'PROCESSED',
  'FAILED',
  'IGNORED',
  'DUPLICATE',
]);

export const planTierEnum = pgEnum('plan_tier', ['STANDARD', 'PREMIUM']);
export const planIntervalEnum = pgEnum('plan_interval', ['MONTHLY', 'QUARTERLY', 'YEARLY']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'CREATED',
  'AUTHENTICATED',
  'ACTIVE',
  'PENDING',
  'PAUSED',
  'HALTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
]);

export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'WRITE_OFF',
]);

export const paymentInstrumentEnum = pgEnum('payment_instrument', [
  'CARD',
  'UPI',
  'NETBANKING',
  'WALLET',
]);

// ── webhookEvents ─────────────────────────────────────────────────────────────
// One row per Razorpay webhook delivery. eventId UNIQUE → idempotency key.
// Replays are detected before any side-effects fire.
export const webhookEvents = pgTable('webhook_events', {
  id:             uuid('id').primaryKey().defaultRandom(),
  provider:       varchar('provider', { length: 50 }).default('razorpay').notNull(),
  eventId:        varchar('event_id', { length: 200 }).notNull(),     // Razorpay x-razorpay-event-id
  eventType:      varchar('event_type', { length: 100 }).notNull(),   // payment.captured, refund.processed, etc.
  status:         webhookEventStatusEnum('status').default('RECEIVED').notNull(),
  payload:        jsonb('payload').notNull(),
  signature:      varchar('signature', { length: 500 }),
  attempts:       integer('attempts').default(0).notNull(),
  lastError:      text('last_error'),
  receivedAt:     timestamp('received_at').defaultNow().notNull(),
  processedAt:    timestamp('processed_at'),
}, (t) => ({
  uniqueProviderEvent: uniqueIndex('webhook_events_provider_event_uniq').on(t.provider, t.eventId),
  typeIdx:             index('webhook_events_type_idx').on(t.eventType),
  statusIdx:           index('webhook_events_status_idx').on(t.status),
}));

// ── refunds ───────────────────────────────────────────────────────────────────
// First-class refund records. Multiple refunds per payment → partial refunds.
// invariants:
//   sum(amount where status=COMPLETED) ≤ payments.amount
//   one open (REQUESTED|APPROVED|PROCESSING) refund per payment at a time enforced in service
export const refunds = pgTable('refunds', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  paymentId:            uuid('payment_id').notNull().references(() => payments.id),
  bookingId:            uuid('booking_id').references(() => bookings.id),
  amount:               decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason:               refundReasonEnum('reason').notNull(),
  reasonDetails:        text('reason_details'),
  status:               refundStatusEnum('status').default('REQUESTED').notNull(),
  razorpayRefundId:     varchar('razorpay_refund_id', { length: 200 }),
  requestedBy:          text('requested_by').references(() => user.id),
  approvedBy:           text('approved_by').references(() => user.id),
  failureReason:        text('failure_reason'),
  requestedAt:          timestamp('requested_at').defaultNow().notNull(),
  approvedAt:           timestamp('approved_at'),
  processedAt:          timestamp('processed_at'),
  refundToWallet:       boolean('refund_to_wallet').default(false).notNull(),
}, (t) => ({
  paymentIdx:    index('refunds_payment_idx').on(t.paymentId),
  bookingIdx:    index('refunds_booking_idx').on(t.bookingId),
  statusIdx:     index('refunds_status_idx').on(t.status),
  requestedByIx: index('refunds_requested_by_idx').on(t.requestedBy),
}));

// ── invoiceSequences ──────────────────────────────────────────────────────────
// Per-financial-year monotonic counter for GST-compliant invoice numbers.
// Shape: SS/{financialYear}/{counter:6} e.g. SS/2526/000001
export const invoiceSequences = pgTable('invoice_sequences', {
  id:             uuid('id').primaryKey().defaultRandom(),
  financialYear:  varchar('financial_year', { length: 7 }).unique().notNull(),  // "2526" for FY2025-26
  lastNumber:     integer('last_number').default(0).notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
});

// ── invoices ──────────────────────────────────────────────────────────────────
// GST-compliant invoice records. Each PAID booking → exactly one INVOICE row.
// taxBreakdown jsonb stores { cgst, sgst, igst, rate } for per-line itemisation.
export const invoices = pgTable('invoices', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  invoiceNo:          varchar('invoice_no', { length: 32 }).unique().notNull(),
  bookingId:          uuid('booking_id').references(() => bookings.id),
  orderId:            uuid('order_id').references(() => orders.id),
  paymentId:          uuid('payment_id').references(() => payments.id),
  customerId:         text('customer_id').notNull().references(() => user.id),
  vendorId:           uuid('vendor_id').references(() => vendors.id),
  customerName:       varchar('customer_name', { length: 255 }).notNull(),
  customerGstin:      varchar('customer_gstin', { length: 15 }),
  vendorName:         varchar('vendor_name', { length: 255 }),
  vendorGstin:        varchar('vendor_gstin', { length: 15 }),
  placeOfSupply:      varchar('place_of_supply', { length: 100 }),    // state name
  hsnCode:            varchar('hsn_code', { length: 12 }),
  subtotal:           decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discount:           decimal('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxableValue:       decimal('taxable_value', { precision: 12, scale: 2 }).notNull(),
  cgst:               decimal('cgst', { precision: 12, scale: 2 }).default('0').notNull(),
  sgst:               decimal('sgst', { precision: 12, scale: 2 }).default('0').notNull(),
  igst:               decimal('igst', { precision: 12, scale: 2 }).default('0').notNull(),
  totalTax:           decimal('total_tax', { precision: 12, scale: 2 }).default('0').notNull(),
  totalAmount:        decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  taxBreakdown:       jsonb('tax_breakdown'),
  lineItems:          jsonb('line_items').notNull(),
  status:             invoiceStatusEnum('status').default('ISSUED').notNull(),
  pdfR2Key:           varchar('pdf_r2_key', { length: 500 }),
  issuedAt:           timestamp('issued_at').defaultNow().notNull(),
  cancelledAt:        timestamp('cancelled_at'),
  creditNoteFor:      uuid('credit_note_for'),                         // self-ref via service
  notes:              text('notes'),
}, (t) => ({
  bookingIdx:   index('invoices_booking_idx').on(t.bookingId),
  orderIdx:     index('invoices_order_idx').on(t.orderId),
  customerIdx:  index('invoices_customer_idx').on(t.customerId),
  vendorIdx:    index('invoices_vendor_idx').on(t.vendorId),
  issuedIdx:    index('invoices_issued_idx').on(t.issuedAt),
}));

// ── payouts ───────────────────────────────────────────────────────────────────
// Vendor settlement records. Each escrow release / store-order fulfilment
// produces a payout row. platformFee captured for revenue recognition.
export const payouts = pgTable('payouts', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  vendorId:            uuid('vendor_id').notNull().references(() => vendors.id),
  bookingId:           uuid('booking_id').references(() => bookings.id),
  orderId:             uuid('order_id').references(() => orders.id),
  escrowId:            uuid('escrow_id').references(() => escrowAccounts.id),
  grossAmount:         decimal('gross_amount', { precision: 12, scale: 2 }).notNull(),
  platformFee:         decimal('platform_fee', { precision: 12, scale: 2 }).default('0').notNull(),
  taxWithheld:         decimal('tax_withheld', { precision: 12, scale: 2 }).default('0').notNull(),
  netAmount:           decimal('net_amount', { precision: 12, scale: 2 }).notNull(),
  currency:            varchar('currency', { length: 3 }).default('INR').notNull(),
  status:              payoutStatusEnum('status').default('SCHEDULED').notNull(),
  razorpayPayoutId:    varchar('razorpay_payout_id', { length: 200 }),
  razorpayTransferId:  varchar('razorpay_transfer_id', { length: 200 }),
  vendorAccountRef:    varchar('vendor_account_ref', { length: 200 }),
  scheduledFor:        timestamp('scheduled_for'),
  processedAt:         timestamp('processed_at'),
  failureReason:       text('failure_reason'),
  attempts:            integer('attempts').default(0).notNull(),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  vendorIdx:   index('payouts_vendor_idx').on(t.vendorId),
  statusIdx:   index('payouts_status_idx').on(t.status),
  bookingIdx:  index('payouts_booking_idx').on(t.bookingId),
  orderIdx:    index('payouts_order_idx').on(t.orderId),
}));

// ── wallets ───────────────────────────────────────────────────────────────────
// One wallet per user. balance is denormalised running total — authoritative
// values come from sum(walletTransactions) but balance is read-fast.
export const wallets = pgTable('wallets', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       text('user_id').unique().notNull().references(() => user.id, { onDelete: 'cascade' }),
  balance:      decimal('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  lifetimeIn:   decimal('lifetime_in', { precision: 12, scale: 2 }).default('0').notNull(),
  lifetimeOut:  decimal('lifetime_out', { precision: 12, scale: 2 }).default('0').notNull(),
  currency:     varchar('currency', { length: 3 }).default('INR').notNull(),
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

// Append-only ledger. Every entry is immutable. balanceAfter snapshot enables
// point-in-time reconstruction without aggregating all prior rows.
export const walletTransactions = pgTable('wallet_transactions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  walletId:       uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  userId:         text('user_id').notNull().references(() => user.id),
  type:           walletTxnTypeEnum('type').notNull(),
  reason:         walletTxnReasonEnum('reason').notNull(),
  amount:         decimal('amount', { precision: 12, scale: 2 }).notNull(),
  balanceAfter:   decimal('balance_after', { precision: 12, scale: 2 }).notNull(),
  description:    varchar('description', { length: 500 }),
  referenceType:  varchar('reference_type', { length: 50 }),       // booking | order | refund | promo | manual
  referenceId:    varchar('reference_id', { length: 100 }),
  metadata:       jsonb('metadata'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  walletIdx:    index('wallet_txn_wallet_idx').on(t.walletId),
  userIdx:      index('wallet_txn_user_idx').on(t.userId),
  refIdx:       index('wallet_txn_ref_idx').on(t.referenceType, t.referenceId),
  createdIdx:   index('wallet_txn_created_idx').on(t.createdAt),
}));

// ── promoCodes ────────────────────────────────────────────────────────────────
export const promoCodes = pgTable('promo_codes', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  code:               varchar('code', { length: 32 }).unique().notNull(),
  description:        varchar('description', { length: 255 }),
  type:               promoTypeEnum('type').notNull(),
  value:              decimal('value', { precision: 12, scale: 2 }).notNull(),       // percent or rupees
  scope:              promoScopeEnum('scope').default('ALL').notNull(),
  minOrderAmount:     decimal('min_order_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  maxDiscount:        decimal('max_discount', { precision: 12, scale: 2 }),           // null = uncapped
  usageLimit:         integer('usage_limit'),                                          // null = unlimited
  perUserLimit:       integer('per_user_limit').default(1).notNull(),
  usedCount:          integer('used_count').default(0).notNull(),
  validFrom:          timestamp('valid_from').defaultNow().notNull(),
  validUntil:         timestamp('valid_until'),
  firstTimeUserOnly:  boolean('first_time_user_only').default(false).notNull(),
  isActive:           boolean('is_active').default(true).notNull(),
  createdBy:          text('created_by').references(() => user.id),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  activeIdx: index('promo_active_idx').on(t.isActive, t.validUntil),
}));

export const promoRedemptions = pgTable('promo_redemptions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  promoId:      uuid('promo_id').notNull().references(() => promoCodes.id, { onDelete: 'cascade' }),
  userId:       text('user_id').notNull().references(() => user.id),
  bookingId:    uuid('booking_id').references(() => bookings.id),
  orderId:      uuid('order_id').references(() => orders.id),
  discount:     decimal('discount', { precision: 12, scale: 2 }).notNull(),
  redeemedAt:   timestamp('redeemed_at').defaultNow().notNull(),
}, (t) => ({
  promoIdx:  index('promo_redemptions_promo_idx').on(t.promoId),
  userIdx:   index('promo_redemptions_user_idx').on(t.userId),
}));

// ── paymentLinks ──────────────────────────────────────────────────────────────
// Shareable payment requests (Razorpay paymentLink.create). Used for ad-hoc
// vendor-to-customer collection, deposit requests, top-ups, etc.
export const paymentLinks = pgTable('payment_links', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  shortId:             varchar('short_id', { length: 12 }).unique().notNull(),
  amount:              decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:            varchar('currency', { length: 3 }).default('INR').notNull(),
  description:         varchar('description', { length: 500 }).notNull(),
  customerName:        varchar('customer_name', { length: 255 }),
  customerEmail:       varchar('customer_email', { length: 255 }),
  customerPhone:       varchar('customer_phone', { length: 15 }),
  bookingId:           uuid('booking_id').references(() => bookings.id),
  status:              paymentLinkStatusEnum('status').default('ACTIVE').notNull(),
  razorpayLinkId:      varchar('razorpay_link_id', { length: 200 }),
  razorpayShortUrl:    varchar('razorpay_short_url', { length: 500 }),
  razorpayPaymentId:   varchar('razorpay_payment_id', { length: 200 }),
  expiresAt:           timestamp('expires_at'),
  paidAt:              timestamp('paid_at'),
  createdBy:           text('created_by').notNull().references(() => user.id),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  createdByIdx: index('payment_links_created_by_idx').on(t.createdBy),
  statusIdx:    index('payment_links_status_idx').on(t.status),
  bookingIdx:   index('payment_links_booking_idx').on(t.bookingId),
}));

// ── paymentMethods (saved tokenised instruments) ──────────────────────────────
export const paymentMethods = pgTable('payment_methods', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  instrument:          paymentInstrumentEnum('instrument').notNull(),
  razorpayTokenId:     varchar('razorpay_token_id', { length: 200 }),
  razorpayCustomerId:  varchar('razorpay_customer_id', { length: 200 }),
  cardLast4:           varchar('card_last4', { length: 4 }),
  cardNetwork:         varchar('card_network', { length: 30 }),
  cardExpiryMonth:     integer('card_expiry_month'),
  cardExpiryYear:      integer('card_expiry_year'),
  upiVpa:              varchar('upi_vpa', { length: 100 }),
  bankName:            varchar('bank_name', { length: 100 }),
  walletProvider:      varchar('wallet_provider', { length: 50 }),
  isDefault:           boolean('is_default').default(false).notNull(),
  isActive:            boolean('is_active').default(true).notNull(),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx:    index('payment_methods_user_idx').on(t.userId),
  defaultIdx: index('payment_methods_default_idx').on(t.userId, t.isDefault),
}));

// ── plans (Razorpay-backed subscription plans) ────────────────────────────────
export const plans = pgTable('plans', {
  id:               uuid('id').primaryKey().defaultRandom(),
  code:             varchar('code', { length: 50 }).unique().notNull(),
  name:             varchar('name', { length: 100 }).notNull(),
  tier:             planTierEnum('tier').notNull(),
  interval:         planIntervalEnum('interval').notNull(),
  amount:           decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:         varchar('currency', { length: 3 }).default('INR').notNull(),
  features:         jsonb('features').default([]).notNull(),
  razorpayPlanId:   varchar('razorpay_plan_id', { length: 200 }),
  active:           boolean('active').default(true).notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
});

// ── subscriptions (per-user) ──────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  userId:                   text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  planId:                   uuid('plan_id').notNull().references(() => plans.id),
  razorpaySubscriptionId:   varchar('razorpay_subscription_id', { length: 200 }),
  status:                   subscriptionStatusEnum('status').default('CREATED').notNull(),
  currentPeriodStart:       timestamp('current_period_start'),
  currentPeriodEnd:         timestamp('current_period_end'),
  gracePeriodEnd:           timestamp('grace_period_end'),
  cancelAtPeriodEnd:        boolean('cancel_at_period_end').default(false).notNull(),
  shortUrl:                 varchar('short_url', { length: 500 }),
  notes:                    jsonb('notes'),
  createdAt:                timestamp('created_at').defaultNow().notNull(),
  updatedAt:                timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdx:   index('subscriptions_user_idx').on(t.userId),
  statusIdx: index('subscriptions_status_idx').on(t.status),
}));

// ── subscriptionCharges (one row per successful charge) ──────────────────────
export const subscriptionCharges = pgTable('subscription_charges', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  subscriptionId:      uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  paymentId:           uuid('payment_id').references(() => payments.id),
  razorpayPaymentId:   varchar('razorpay_payment_id', { length: 200 }),
  amount:              decimal('amount', { precision: 12, scale: 2 }).notNull(),
  periodStart:         timestamp('period_start').notNull(),
  periodEnd:           timestamp('period_end').notNull(),
  status:              varchar('status', { length: 24 }).default('CHARGED').notNull(),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  subIdx: index('subscription_charges_sub_idx').on(t.subscriptionId),
}));

// ── paymentSplits (multi-vendor booking splits) ──────────────────────────────
export const paymentSplits = pgTable('payment_splits', {
  id:           uuid('id').primaryKey().defaultRandom(),
  bookingId:    uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  paymentId:    uuid('payment_id').references(() => payments.id),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id),
  amount:       decimal('amount', { precision: 12, scale: 2 }).notNull(),
  platformFee:  decimal('platform_fee', { precision: 12, scale: 2 }).default('0').notNull(),
  status:       varchar('status', { length: 24 }).default('PENDING').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  bookingIdx: index('payment_splits_booking_idx').on(t.bookingId),
  vendorIdx:  index('payment_splits_vendor_idx').on(t.vendorId),
}));

// ── reconciliationDiscrepancies (Razorpay settlement vs DB mismatches) ──────
export const reconciliationDiscrepancies = pgTable('reconciliation_discrepancies', {
  id:                uuid('id').primaryKey().defaultRandom(),
  paymentId:         uuid('payment_id').references(() => payments.id),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 200 }),
  field:             varchar('field', { length: 50 }).notNull(),
  expected:          text('expected'),
  actual:            text('actual'),
  status:            reconciliationStatusEnum('status').default('OPEN').notNull(),
  notes:             text('notes'),
  detectedAt:        timestamp('detected_at').defaultNow().notNull(),
  resolvedAt:        timestamp('resolved_at'),
}, (t) => ({
  statusIdx:    index('recon_status_idx').on(t.status),
  paymentIdx:   index('recon_payment_idx').on(t.paymentId),
  rzpIdx:       uniqueIndex('recon_rzp_payment_field_idx').on(t.razorpayPaymentId, t.field),
}));

// ── disputeResolutions (idempotency ledger for resolveDispute) ──────────────
export const disputeResolutions = pgTable('dispute_resolutions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  bookingId:    uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  resolutionId: varchar('resolution_id', { length: 100 }).notNull(),
  outcome:      varchar('outcome', { length: 24 }).notNull(),  // RELEASE | REFUND | SPLIT
  amountVendor: decimal('amount_vendor', { precision: 12, scale: 2 }),
  amountCustomer: decimal('amount_customer', { precision: 12, scale: 2 }),
  resolvedBy:   text('resolved_by').notNull(),
  resolvedAt:   timestamp('resolved_at').defaultNow().notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('dispute_resolutions_unique_idx').on(t.bookingId, t.resolutionId),
}));

// ── chatReports (replaces inline [reported] system message) ─────────────────
export const chatReports = pgTable('chat_reports', {
  id:              uuid('id').primaryKey().defaultRandom(),
  reporterUserId:  text('reporter_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reportedUserId:  text('reported_user_id').references(() => user.id, { onDelete: 'set null' }),
  matchRequestId:  uuid('match_request_id'),
  messageId:       varchar('message_id', { length: 100 }),
  reason:          varchar('reason', { length: 64 }).notNull(),
  details:         text('details'),
  status:          varchar('status', { length: 24 }).default('PENDING').notNull(),
  resolvedAt:      timestamp('resolved_at'),
  resolvedBy:      text('resolved_by'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  reporterIdx: index('chat_reports_reporter_idx').on(t.reporterUserId),
  statusIdx:   index('chat_reports_status_idx').on(t.status),
}));
