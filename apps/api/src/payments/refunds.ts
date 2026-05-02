/**
 * Smart Shaadi — Refunds Service.
 *
 * First-class refund records with partial refund support, customer-initiated
 * requests, admin approval, and wallet-credit alternative.
 *
 * Invariants:
 *   sum(refunds.amount where status IN COMPLETED|PROCESSING|APPROVED) ≤ payments.amount
 *   one open (REQUESTED|APPROVED|PROCESSING) refund per payment at a time
 *   audit_logs append-only — REFUND_REQUESTED, REFUND_APPROVED, REFUND_REJECTED, REFUND_ISSUED
 */
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { createRefund as razorpayCreateRefund } from '../lib/razorpay.js';
import { appendAuditLog } from './service.js';
import { creditWallet } from './wallet.js';
import { notificationsQueue } from '../infrastructure/redis/queues.js';
import type { RequestRefundInput, AdminApproveRefundInput } from '@smartshaadi/schemas';

export class RefundError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'RefundError';
  }
}

const OPEN_STATUSES = ['REQUESTED', 'APPROVED', 'PROCESSING'] as const;

async function getRefundedSoFar(paymentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${schema.refunds.amount}), 0)` })
    .from(schema.refunds)
    .where(
      and(
        eq(schema.refunds.paymentId, paymentId),
        inArray(schema.refunds.status, ['COMPLETED', 'PROCESSING', 'APPROVED']),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Customer or admin requests a refund. Auto-approves customer requests
 * within the allowed window; otherwise leaves REQUESTED for admin review. */
export async function requestRefund(
  userId: string,
  input: RequestRefundInput,
  options: { autoApprove?: boolean } = {},
) {
  const [payment] = await db
    .select({ payment: schema.payments, booking: schema.bookings })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(eq(schema.payments.id, input.paymentId))
    .limit(1);

  if (!payment) throw new RefundError('NOT_FOUND', 'Payment not found');
  if (payment.booking.customerId !== userId) {
    throw new RefundError('FORBIDDEN', 'This payment does not belong to you');
  }
  if (payment.payment.status === 'PENDING' || payment.payment.status === 'FAILED') {
    throw new RefundError('INVALID_STATE', 'Cannot refund a payment that has not captured');
  }

  const paymentAmount = parseFloat(payment.payment.amount);
  const requested     = input.amount ?? paymentAmount;

  if (requested <= 0) throw new RefundError('INVALID_AMOUNT', 'Amount must be positive');

  const refundedSoFar = await getRefundedSoFar(payment.payment.id);
  if (refundedSoFar + requested > paymentAmount + 0.01) {
    throw new RefundError(
      'OVER_REFUND',
      `Cannot refund ₹${requested}. Already refunded ₹${refundedSoFar} of ₹${paymentAmount}.`,
    );
  }

  // No concurrent open refunds
  const [open] = await db
    .select({ id: schema.refunds.id })
    .from(schema.refunds)
    .where(
      and(
        eq(schema.refunds.paymentId, payment.payment.id),
        inArray(schema.refunds.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);
  if (open) {
    throw new RefundError('REFUND_IN_PROGRESS', 'A refund is already in progress for this payment');
  }

  const [refund] = await db
    .insert(schema.refunds)
    .values({
      paymentId:      payment.payment.id,
      bookingId:      payment.payment.bookingId,
      amount:         String(requested),
      reason:         input.reason,
      reasonDetails:  input.reasonDetails ?? null,
      refundToWallet: input.refundToWallet,
      requestedBy:    userId,
      status:         'REQUESTED',
    })
    .returning();

  await appendAuditLog({
    eventType:  'REFUND_REQUESTED',
    entityType: 'refund',
    entityId:   refund!.id,
    actorId:    userId,
    payload:    { paymentId: payment.payment.id, amount: requested, reason: input.reason },
  });

  void notificationsQueue
    .add('REFUND_REQUESTED', {
      type:    'REFUND_REQUESTED',
      userId,
      payload: { refundId: refund!.id, amount: requested, paymentId: payment.payment.id },
    })
    .catch(() => undefined);

  if (options.autoApprove) {
    return processRefund(refund!.id, userId);
  }
  return refund!;
}

/** Admin approves or rejects a refund. */
export async function adminApproveRefund(
  adminId: string,
  input: AdminApproveRefundInput,
) {
  const [admin] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') {
    throw new RefundError('FORBIDDEN', 'Admin role required');
  }

  const [refund] = await db
    .select()
    .from(schema.refunds)
    .where(eq(schema.refunds.id, input.refundId))
    .limit(1);
  if (!refund) throw new RefundError('NOT_FOUND', 'Refund not found');
  if (refund.status !== 'REQUESTED') {
    throw new RefundError('INVALID_STATE', `Refund is ${refund.status}, cannot decide now`);
  }

  if (input.approve) {
    const [updated] = await db
      .update(schema.refunds)
      .set({ status: 'APPROVED', approvedBy: adminId, approvedAt: new Date() })
      .where(and(eq(schema.refunds.id, input.refundId), eq(schema.refunds.status, 'REQUESTED')))
      .returning();
    if (!updated) throw new RefundError('CONCURRENT_UPDATE', 'Refund state changed while approving');

    await appendAuditLog({
      eventType:  'REFUND_APPROVED',
      entityType: 'refund',
      entityId:   refund.id,
      actorId:    adminId,
      payload:    { notes: input.notes ?? null },
    });

    return processRefund(refund.id, adminId);
  } else {
    const [updated] = await db
      .update(schema.refunds)
      .set({ status: 'REJECTED', approvedBy: adminId, approvedAt: new Date(), failureReason: input.notes ?? null })
      .where(and(eq(schema.refunds.id, input.refundId), eq(schema.refunds.status, 'REQUESTED')))
      .returning();
    if (!updated) throw new RefundError('CONCURRENT_UPDATE', 'Refund state changed while rejecting');

    await appendAuditLog({
      eventType:  'REFUND_REJECTED',
      entityType: 'refund',
      entityId:   refund.id,
      actorId:    adminId,
      payload:    { notes: input.notes ?? null },
    });

    void notificationsQueue
      .add('REFUND_PROCESSED', {
        type:    'REFUND_PROCESSED',
        userId:  refund.requestedBy ?? adminId,
        payload: { refundId: refund.id, status: 'REJECTED', notes: input.notes ?? null },
      })
      .catch(() => undefined);

    return updated;
  }
}

/** Internal — actually executes the refund (wallet credit OR Razorpay). */
async function processRefund(refundId: string, actorId: string) {
  const [refund] = await db
    .select({ refund: schema.refunds, payment: schema.payments })
    .from(schema.refunds)
    .innerJoin(schema.payments, eq(schema.refunds.paymentId, schema.payments.id))
    .where(eq(schema.refunds.id, refundId))
    .limit(1);
  if (!refund) throw new RefundError('NOT_FOUND', 'Refund not found at processing step');

  // Move REQUESTED|APPROVED → PROCESSING atomically
  const [moved] = await db
    .update(schema.refunds)
    .set({ status: 'PROCESSING' })
    .where(and(eq(schema.refunds.id, refundId), inArray(schema.refunds.status, ['REQUESTED', 'APPROVED'])))
    .returning();
  if (!moved) throw new RefundError('CONCURRENT_UPDATE', 'Refund already being processed');

  const amount = parseFloat(refund.refund.amount);

  try {
    let externalId: string | null = null;

    if (refund.refund.refundToWallet) {
      const requesterId = refund.refund.requestedBy;
      if (!requesterId) throw new RefundError('INTERNAL', 'Refund missing requester for wallet credit');
      const txn = await creditWallet({
        userId:        requesterId,
        amount,
        reason:        'REFUND',
        description:   `Refund for payment ${refund.payment.id}`,
        referenceType: 'refund',
        referenceId:   refundId,
      });
      externalId = txn.id;
    } else {
      if (!refund.payment.razorpayPaymentId) {
        throw new RefundError('INVALID_STATE', 'Payment has no Razorpay ID — refund to wallet instead');
      }
      const razorpayResult = await razorpayCreateRefund(refund.payment.razorpayPaymentId, amount);
      externalId = razorpayResult.id;
    }

    // Roll up payment status
    const totalRefunded = await getRefundedSoFar(refund.payment.id);
    const paymentTotal  = parseFloat(refund.payment.amount);
    const newPaymentStatus =
      Math.abs(totalRefunded - paymentTotal) < 0.01 || totalRefunded + amount >= paymentTotal
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED';

    await db.transaction(async (tx) => {
      await tx
        .update(schema.refunds)
        .set({ status: 'COMPLETED', razorpayRefundId: externalId, processedAt: new Date() })
        .where(eq(schema.refunds.id, refundId));
      await tx
        .update(schema.payments)
        .set({ status: newPaymentStatus })
        .where(eq(schema.payments.id, refund.payment.id));
    });

    await appendAuditLog({
      eventType:  'REFUND_ISSUED',
      entityType: 'refund',
      entityId:   refundId,
      actorId,
      payload:    { paymentId: refund.payment.id, amount, externalId, channel: refund.refund.refundToWallet ? 'WALLET' : 'RAZORPAY' },
    });

    void notificationsQueue
      .add('REFUND_PROCESSED', {
        type:    'REFUND_PROCESSED',
        userId:  refund.refund.requestedBy ?? actorId,
        payload: { refundId, amount, channel: refund.refund.refundToWallet ? 'WALLET' : 'BANK' },
      })
      .catch(() => undefined);

    const [final] = await db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId)).limit(1);
    return final!;
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Unknown failure';
    await db
      .update(schema.refunds)
      .set({ status: 'FAILED', failureReason: reason })
      .where(eq(schema.refunds.id, refundId));
    if (env.NODE_ENV !== 'test') console.error(`[refund] ${refundId} failed:`, e);
    throw e;
  }
}

export async function listMyRefunds(userId: string, limit = 50) {
  const rows = await db
    .select({ refund: schema.refunds, payment: schema.payments })
    .from(schema.refunds)
    .innerJoin(schema.payments, eq(schema.refunds.paymentId, schema.payments.id))
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(eq(schema.bookings.customerId, userId))
    .orderBy(desc(schema.refunds.requestedAt))
    .limit(limit);
  return rows.map(r => r.refund);
}

export async function listAllRefundsForAdmin(adminId: string, status?: string, limit = 100) {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new RefundError('FORBIDDEN', 'Admin role required');

  const where = status
    ? eq(schema.refunds.status, status as typeof schema.refundStatusEnum.enumValues[number])
    : undefined;

  return db
    .select()
    .from(schema.refunds)
    .where(where)
    .orderBy(desc(schema.refunds.requestedAt))
    .limit(limit);
}
