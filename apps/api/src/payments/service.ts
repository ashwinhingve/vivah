/**
 * Smart Shaadi — Payments Service
 * Handles Razorpay order creation, escrow management, refunds, and payment history.
 *
 * Invariants:
 *  - Escrow = exactly 50% of booking.totalAmount (Math.round)
 *  - audit_logs are APPEND-ONLY — never UPDATE or DELETE
 *  - USE_MOCK_SERVICES guard on all external calls (enforced by razorpay.ts)
 */
import { eq, and, desc, sql, notInArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import {
  createOrder,
  createRefund,
} from '../lib/razorpay.js';
import { rupeesToPaise } from '../lib/money.js';
import { auditContentHash } from '../lib/auditHash.js';
import { AppError } from '../lib/errors.js';
import type { PaymentOrder } from '@smartshaadi/types';
import type { CreatePaymentInput, RefundInput } from '@smartshaadi/schemas';

// ---------------------------------------------------------------------------
// Audit log helper — append-only, never update. Hash via the shared canonical
// helper (lib/auditHash) so write-time and verify-time hashes agree across the
// jsonb round-trip (P2-1) and never drift between copies (P2-6).
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
  const contentHash = auditContentHash(payload, prevHash);
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
    throw new AppError('NOT_FOUND', 'Booking not found', 404);
  }

  // 2. Verify ownership
  if (booking.customerId !== userId) {
    throw new AppError('FORBIDDEN', 'Forbidden: booking does not belong to this user', 403);
  }

  // 3. Verify booking status
  if (booking.status !== 'CONFIRMED') {
    throw new AppError('INVALID_STATE', 'Booking must be CONFIRMED before payment', 400);
  }

  // 4. Escrow = exactly 50% of booking total (in rupees)
  const totalAmount = parseFloat(booking.totalAmount);
  const escrowAmount = Math.round(totalAmount * 0.5);

  // 5. Create Razorpay order. Razorpay requires amount in paise — multiply at
  // the integration boundary only. Elsewhere we store/return rupees.
  const order = await createOrder(rupeesToPaise(escrowAmount), 'INR', booking.id);

  // 6. Insert payments row (amount stored in rupees)
  await db.insert(schema.payments).values({
    bookingId:       booking.id,
    amount:          String(escrowAmount),
    currency:        'INR',
    status:          'PENDING',
    razorpayOrderId: order.id,
  });

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
    throw new AppError('NOT_FOUND', `Payment not found for order: ${razorpayOrderId}`, 404);
  }

  // Idempotency — if this webhook has already been processed for this order,
  // short-circuit. Razorpay retries on 5xx so a duplicate must return 200 noop.
  if (payment.status === 'CAPTURED') {
    return;
  }

  // 2. Atomic capture — only flip PENDING → CAPTURED. P1-2 (PHASE-1-4-AUDIT):
  // the previous unconditional UPDATE left a TOCTOU window where two concurrent
  // webhook deliveries could both pass the read-time guard above and both run
  // the side-effects below (escrow insert is onConflictDoNothing-safe, but the
  // PAYMENT_RECEIVED audit log would be appended twice). `.returning()` + a
  // zero-row guard makes the loser exit before any audit log is written.
  const captured = await db
    .update(schema.payments)
    .set({ razorpayPaymentId, status: 'CAPTURED' })
    .where(and(
      eq(schema.payments.id, payment.id),
      eq(schema.payments.status, 'PENDING'),
    ))
    .returning({ id: schema.payments.id });

  if (captured.length === 0) {
    // Another webhook delivery captured this payment between our SELECT and
    // UPDATE — treat as a no-op replay. Webhook-level dedup also catches this
    // via webhookEvents.recordWebhookEvent, but the conditional UPDATE is the
    // defence-in-depth guard for non-Razorpay callers.
    return;
  }

  // 3. Get booking for customerId (actorId)
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, payment.bookingId));

  const actorId = booking?.customerId ?? 'system';

  // 4. Insert escrowAccounts row. bookingId is unique — onConflictDoNothing
  // keeps duplicate webhooks safe without hitting a 23505 from Postgres.
  await db
    .insert(schema.escrowAccounts)
    .values({
      bookingId:  payment.bookingId,
      totalHeld:  payment.amount,
      released:   '0',
      status:     'HELD',
    })
    .onConflictDoNothing({ target: schema.escrowAccounts.bookingId });

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
    throw new AppError('NOT_FOUND', 'Payment not found or forbidden', 404);
  }

  const { payment } = rows[0]!;

  if (!payment.razorpayPaymentId) {
    throw new AppError('INVALID_STATE', 'Payment has no Razorpay payment ID — cannot refund', 400);
  }

  // 2. Claim the refund atomically BEFORE calling Razorpay (P1-S2). Flip the payment
  //    to REFUND_PENDING only if it is not already refunded / in progress / failed —
  //    the status guard means only one of two concurrent requests wins (0 rows =
  //    already claimed → reject), so Razorpay is never called twice for one payment.
  //    Replaces the previous Razorpay-first, unguarded UPDATE that relied entirely on
  //    Razorpay's refundable-amount cap to prevent a double refund.
  const claimed = await db
    .update(schema.payments)
    .set({ status: 'REFUND_PENDING' })
    .where(and(
      eq(schema.payments.id, payment.id),
      notInArray(schema.payments.status, ['REFUNDED', 'REFUND_PENDING', 'FAILED']),
    ))
    .returning({ id: schema.payments.id });

  if (claimed.length === 0) {
    throw new AppError('CONFLICT', 'Payment is not in a refundable state (already refunded or a refund is in progress)', 409);
  }

  // 3. Call Razorpay with a deterministic idempotency key (razorpay.ts A2-03) so a
  //    retried lost-response call is deduped. On failure, revert the claim so the
  //    user can retry — the key keeps a duplicate Razorpay call safe.
  try {
    await createRefund(
      payment.razorpayPaymentId,
      rupeesToPaise(parseFloat(payment.amount)),
      undefined,
      `refund:${payment.id}`,
    );
  } catch (e) {
    await db
      .update(schema.payments)
      .set({ status: payment.status })
      .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, 'REFUND_PENDING')));
    throw e;
  }

  // 4. Finalise REFUND_PENDING → REFUNDED.
  await db
    .update(schema.payments)
    .set({ status: 'REFUNDED' })
    .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, 'REFUND_PENDING')));

  // 5. Append audit log (NEVER update)
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

  // Real total count for pagination — bare rows.length would equal the page size
  const [countRow] = await db
    .select({ total: sql<string>`count(*)` })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(eq(schema.bookings.customerId, userId));
  const total = Number(countRow?.total ?? 0);

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
    total,
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

// ---------------------------------------------------------------------------
// handlePaymentFailed — called by webhook on payment.failed
// ---------------------------------------------------------------------------
export async function handlePaymentFailed(
  razorpayOrderId: string,
  errorCode: string,
  errorDescription: string,
): Promise<void> {
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.razorpayOrderId, razorpayOrderId))
    .limit(1);
  if (!payment) return;
  if (payment.status === 'CAPTURED' || payment.status === 'REFUNDED') return;

  await db
    .update(schema.payments)
    .set({ status: 'FAILED' })
    .where(eq(schema.payments.id, payment.id));

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, payment.bookingId));
  const actorId = booking?.customerId ?? 'system';

  await appendAuditLog({
    eventType:  'PAYMENT_FAILED',
    entityType: 'payment',
    entityId:   payment.id,
    actorId,
    payload:    { razorpayOrderId, errorCode, errorDescription },
  });
}

// ---------------------------------------------------------------------------
// retryPaymentOrder — creates a fresh Razorpay order for a previously failed
// payment, allowing the customer another attempt without re-creating the booking.
// ---------------------------------------------------------------------------
export async function retryPaymentOrder(userId: string, bookingId: string): Promise<PaymentOrder> {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);
  if (booking.customerId !== userId) throw new AppError('FORBIDDEN', 'Forbidden', 403);
  if (booking.status !== 'CONFIRMED') throw new AppError('INVALID_STATE', 'Booking must be CONFIRMED', 400);

  // Look up the most-recent payment for this booking. If it's already CAPTURED, refuse.
  const [latest] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.bookingId, bookingId))
    .orderBy(desc(schema.payments.createdAt))
    .limit(1);

  if (latest && latest.status === 'CAPTURED') {
    throw new AppError('CONFLICT', 'Payment already captured for this booking', 409);
  }

  return createPaymentOrder(userId, { bookingId });
}

// Export for escrow job. (Hashing now lives in lib/auditHash → auditContentHash.)
export { appendAuditLog };
