/**
 * Smart Shaadi — Payments Service
 * Handles Razorpay order creation, escrow management, refunds, and payment history.
 *
 * Invariants:
 *  - Escrow = exactly 50% of booking.totalAmount (Math.round)
 *  - audit_logs are APPEND-ONLY — never UPDATE or DELETE
 *  - USE_MOCK_SERVICES guard on all external calls (enforced by razorpay.ts)
 */
import { createHash } from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import {
  createOrder,
  createRefund,
} from '../lib/razorpay.js';
import type { PaymentOrder } from '@smartshaadi/types';
import type { CreatePaymentInput, RefundInput } from '@smartshaadi/schemas';

// ---------------------------------------------------------------------------
// Hash utility — required for audit_logs.contentHash (NOT NULL)
// ---------------------------------------------------------------------------
function computeHash(payload: unknown, prevHash: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(payload) + (prevHash ?? ''))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Audit log helper — append-only, never update
// ---------------------------------------------------------------------------
async function appendAuditLog({
  eventType,
  entityType,
  entityId,
  actorId,
  payload,
}: {
  eventType: typeof schema.auditEventTypeEnum.enumValues[number];
  entityType: string;
  entityId: string;
  actorId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Fetch previous hash for this entity to form the chain
  const [lastLog] = await db
    .select({ contentHash: schema.auditLogs.contentHash })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.entityId, entityId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);
  const prevHash = lastLog?.contentHash ?? null;
  const contentHash = computeHash(payload, prevHash);
  await db.insert(schema.auditLogs).values({
    eventType,
    entityType,
    entityId,
    actorId,
    payload,
    contentHash,
    prevHash,
  });
}

// ---------------------------------------------------------------------------
// createPaymentOrder
// ---------------------------------------------------------------------------
export async function createPaymentOrder(
  userId: string,
  input: CreatePaymentInput,
): Promise<PaymentOrder> {
  // 1. Fetch booking
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, input.bookingId))
    .limit(1);

  if (!booking) {
    throw new Error('Booking not found');
  }

  // 2. Verify ownership
  if (booking.customerId !== userId) {
    throw new Error('Forbidden: booking does not belong to this user');
  }

  // 3. Verify booking status
  if (booking.status !== 'CONFIRMED') {
    throw new Error('Booking must be CONFIRMED before payment');
  }

  // 4. Escrow = exactly 50%
  const totalAmount = parseFloat(booking.totalAmount);
  const escrowAmount = Math.round(totalAmount * 0.5);

  // 5. Create Razorpay order
  const order = await createOrder(escrowAmount, 'INR', booking.id);

  // 6. Insert payments row
  await db.insert(schema.payments).values({
    bookingId:       booking.id,
    amount:          String(escrowAmount),
    currency:        'INR',
    status:          'PENDING',
    razorpayOrderId: order.id,
  });

  // 7. Return PaymentOrder
  return {
    razorpayOrderId: order.id,
    amount:          escrowAmount,
    currency:        'INR',
    bookingId:       booking.id,
  };
}

// ---------------------------------------------------------------------------
// handlePaymentSuccess — called by webhook on payment.captured
// ---------------------------------------------------------------------------
export async function handlePaymentSuccess(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<void> {
  // 1. Find payment
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.razorpayOrderId, razorpayOrderId))
    .limit(1);

  if (!payment) {
    throw new Error(`Payment not found for order: ${razorpayOrderId}`);
  }

  // 2. Update payment status → CAPTURED
  await db
    .update(schema.payments)
    .set({ razorpayPaymentId, status: 'CAPTURED' })
    .where(eq(schema.payments.id, payment.id));

  // 3. Get booking for customerId (actorId)
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, payment.bookingId));

  const actorId = booking?.customerId ?? 'system';

  // 4. Insert escrowAccounts row
  await db.insert(schema.escrowAccounts).values({
    bookingId:  payment.bookingId,
    totalHeld:  payment.amount,
    released:   '0',
    status:     'HELD',
  });

  // 5. Append audit logs — payment received + escrow held (two distinct events)
  const auditPayload = { razorpayPaymentId, razorpayOrderId, amount: payment.amount };
  await appendAuditLog({
    eventType:  'PAYMENT_RECEIVED',
    entityType: 'payment',
    entityId:   payment.id,
    actorId,
    payload:    auditPayload,
  });
  await appendAuditLog({
    eventType:  'ESCROW_HELD',
    entityType: 'escrow',
    entityId:   payment.bookingId,
    actorId,
    payload:    { bookingId: payment.bookingId, totalHeld: payment.amount },
  });
}

// ---------------------------------------------------------------------------
// requestRefund
// ---------------------------------------------------------------------------
export async function requestRefund(
  userId: string,
  paymentId: string,
  _input: RefundInput,
): Promise<void> {
  // 1. Fetch payment + booking join to verify ownership
  const rows = await db
    .select({ payment: schema.payments, booking: schema.bookings })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.payments.id, paymentId),
        eq(schema.bookings.customerId, userId),
      ),
    );

  if (rows.length === 0) {
    throw new Error('Payment not found or forbidden');
  }

  const { payment } = rows[0]!;

  if (!payment.razorpayPaymentId) {
    throw new Error('Payment has no Razorpay payment ID — cannot refund');
  }

  // 2. Call Razorpay refund
  await createRefund(payment.razorpayPaymentId, parseFloat(payment.amount));

  // 3. Update payment status → REFUNDED
  await db
    .update(schema.payments)
    .set({ status: 'REFUNDED' })
    .where(eq(schema.payments.id, payment.id));

  // 4. Append audit log (NEVER update)
  const auditPayload = { paymentId: payment.id, amount: payment.amount, refunded: true };
  await appendAuditLog({
    eventType:  'REFUND_ISSUED',
    entityType: 'payment',
    entityId:   payment.id,
    actorId:    userId,
    payload:    auditPayload,
  });
}

// ---------------------------------------------------------------------------
// getPaymentHistory — paginated, joined via bookings.customerId
// ---------------------------------------------------------------------------
export interface PaymentHistoryEscrow {
  id:           string;
  bookingId:    string;
  totalHeld:    string;
  released:     string;
  status:       string;
  releaseDueAt: Date | null;
  releasedAt:   Date | null;
}

export interface PaymentHistoryItem {
  id:               string;
  bookingId:        string;
  amount:           string;
  currency:         string;
  status:           string;
  razorpayOrderId:  string;
  razorpayPaymentId: string | null;
  createdAt:        Date;
  escrow:           PaymentHistoryEscrow | null;
}

export async function getPaymentHistory(
  userId: string,
  page = 1,
  limit = 10,
): Promise<{ items: PaymentHistoryItem[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Join payments → bookings + left-join escrow to eliminate N+1 fetches
  const rows = await db
    .select({
      id:                schema.payments.id,
      bookingId:         schema.payments.bookingId,
      amount:            schema.payments.amount,
      currency:          schema.payments.currency,
      status:            schema.payments.status,
      razorpayOrderId:   schema.payments.razorpayOrderId,
      razorpayPaymentId: schema.payments.razorpayPaymentId,
      createdAt:         schema.payments.createdAt,
      escrowId:          schema.escrowAccounts.id,
      escrowTotalHeld:   schema.escrowAccounts.totalHeld,
      escrowReleased:    schema.escrowAccounts.released,
      escrowStatus:      schema.escrowAccounts.status,
      escrowReleaseDueAt: schema.escrowAccounts.releaseDueAt,
      escrowReleasedAt:   schema.escrowAccounts.releasedAt,
    })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .leftJoin(schema.escrowAccounts, eq(schema.escrowAccounts.bookingId, schema.payments.bookingId))
    .where(eq(schema.bookings.customerId, userId))
    .orderBy(desc(schema.payments.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map(r => ({
      id:                r.id,
      bookingId:         r.bookingId,
      amount:            r.amount as unknown as string,
      currency:          r.currency ?? 'INR',
      status:            r.status,
      razorpayOrderId:   r.razorpayOrderId ?? '',
      razorpayPaymentId: r.razorpayPaymentId ?? null,
      createdAt:         r.createdAt,
      escrow: r.escrowId ? {
        id:           r.escrowId,
        bookingId:    r.bookingId,
        totalHeld:    r.escrowTotalHeld ?? '0',
        released:     r.escrowReleased ?? '0',
        status:       r.escrowStatus ?? 'HELD',
        releaseDueAt: r.escrowReleaseDueAt ?? null,
        releasedAt:   r.escrowReleasedAt ?? null,
      } : null,
    })),
    total: rows.length,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// getEscrowStatus
// ---------------------------------------------------------------------------
export async function getEscrowStatus(bookingId: string) {
  const [escrow] = await db
    .select()
    .from(schema.escrowAccounts)
    .where(eq(schema.escrowAccounts.bookingId, bookingId));

  return escrow ?? null;
}

// ---------------------------------------------------------------------------
// markBookingDisputed — used by webhook dispute.created handler
// ---------------------------------------------------------------------------
export async function markBookingDisputed(bookingId: string): Promise<void> {
  await db
    .update(schema.bookings)
    .set({ status: 'DISPUTED' })
    .where(eq(schema.bookings.id, bookingId));

  // Update escrow status too
  await db
    .update(schema.escrowAccounts)
    .set({ status: 'DISPUTED' })
    .where(eq(schema.escrowAccounts.bookingId, bookingId));

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.bookingId, bookingId))
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);

  if (payment) {
    const auditPayload = { bookingId };
    await appendAuditLog({
      eventType:  'ESCROW_DISPUTED',
      entityType: 'booking',
      entityId:   bookingId,
      actorId:    'system',
      payload:    auditPayload,
    });
  }
}

// Export for escrow job
export { computeHash, appendAuditLog };
