/**
 * Smart Shaadi — Dispute Service
 *
 * Handles the full escrow dispute state machine:
 *   raiseDispute    — customer raises a dispute; cancels pending Bull release job
 *   resolveDispute  — admin resolves: RELEASE | REFUND | SPLIT
 *   getDisputedBookings — admin lists all disputed bookings
 *
 * Invariants:
 *   - Bull escrow-release job is cancelled BEFORE status is updated to DISPUTED (deterministic ID)
 *   - Optimistic locking via SELECT … FOR UPDATE prevents double-dispute on concurrent calls
 *   - DB transaction commits FIRST; Razorpay call comes second — failure sets *_PENDING, no rollback
 *   - audit_logs are APPEND-ONLY (hash-chain via appendAuditLog from payments/service.ts)
 *   - All queries filtered by userId; ADMIN check via user.role === 'ADMIN'
 *   - USE_MOCK_SERVICES guard on all Razorpay calls
 */
import { eq, and, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor, createRefund } from '../lib/razorpay.js';
import { rupeesToPaise } from '../lib/money.js';
import { appendAuditLog } from './service.js';
import { escrowReleaseQueue, notificationsQueue } from '../infrastructure/redis/queues.js';
import { notifyAdmins } from '../notifications/service.js';
import type { DisputeEscrowInput } from '@smartshaadi/schemas';
import { logger } from '../lib/logger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cancelEscrowReleaseJob(bookingId: string): Promise<void> {
  try {
    const job = await escrowReleaseQueue.getJob(`escrow-release-${bookingId}`);
    if (job) {
      await job.remove();
    }
  } catch (e) {
    console.warn(`[dispute] cancelEscrowReleaseJob failed for ${bookingId}:`, e);
  }
}

// ── raiseDispute ──────────────────────────────────────────────────────────────

export interface RaiseDisputeResult {
  success:   true;
  bookingId: string;
  status:    'DISPUTED';
}

export async function raiseDispute(
  userId: string,
  bookingId: string,
  input: DisputeEscrowInput,
): Promise<RaiseDisputeResult> {
  // 1. Verify ownership before entering the transaction (fast rejection)
  const [bookingCheck] = await db
    .select({ id: schema.bookings.id, customerId: schema.bookings.customerId })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!bookingCheck) {
    throw new Error('Booking not found');
  }
  if (bookingCheck.customerId !== userId) {
    throw new Error('Forbidden: booking does not belong to this user');
  }

  // 2. Transaction with SELECT … FOR UPDATE to prevent concurrent double-dispute.
  //    Bull job cancellation is deferred to AFTER commit so a rolled-back
  //    transaction does not orphan the escrow auto-release.
  let vendorId: string;

  await db.transaction(async (tx) => {
    // Row-level lock on the booking
    const locked = await tx.execute(
      sql`SELECT id, status, vendor_id FROM bookings WHERE id = ${bookingId} FOR UPDATE`,
    );
    const lockedRow = locked.rows[0] as { id: string; status: string; vendor_id: string } | undefined;

    if (!lockedRow) {
      throw new Error('Booking not found');
    }
    if (lockedRow.status !== 'CONFIRMED' && lockedRow.status !== 'COMPLETED') {
      throw new Error(`Invalid state: booking status is ${lockedRow.status}, must be CONFIRMED or COMPLETED`);
    }

    vendorId = lockedRow.vendor_id;

    // Fetch escrow inside txn
    const [escrow] = await tx
      .select()
      .from(schema.escrowAccounts)
      .where(eq(schema.escrowAccounts.bookingId, bookingId))
      .limit(1);

    if (!escrow || escrow.status !== 'HELD') {
      throw new Error(`Invalid state: escrow status is ${escrow?.status ?? 'missing'}, must be HELD`);
    }

    // Atomic update booking
    const updated = await tx
      .update(schema.bookings)
      .set({ status: 'DISPUTED', updatedAt: new Date() })
      .where(
        and(
          eq(schema.bookings.id, bookingId),
          inArray(schema.bookings.status, ['CONFIRMED', 'COMPLETED']),
        ),
      )
      .returning({ id: schema.bookings.id });

    if (updated.length === 0) {
      throw new Error('BOOKING_ALREADY_DISPUTED or invalid status');
    }

    // Update escrow status
    await tx
      .update(schema.escrowAccounts)
      .set({ status: 'DISPUTED' })
      .where(eq(schema.escrowAccounts.id, escrow.id));

    // Append audit log inside txn
    await appendAuditLog({
      eventType:  'DISPUTE_RAISED',
      entityType: 'booking',
      entityId:   bookingId,
      actorId:    userId,
      payload:    {
        reason:    input.reason,
        bookingId,
        escrowId:  escrow.id,
        raisedAt:  new Date().toISOString(),
      },
    });
  });

  // 4. Cancel the pending escrow auto-release Bull job AFTER commit.
  //    Deterministic job ID `escrow-release-${bookingId}` makes this idempotent.
  await cancelEscrowReleaseJob(bookingId);

  // 5. Enqueue notifications. Vendor recipient is the user.id behind vendors.id.
  const [vendorRow] = await db
    .select({ userId: schema.vendors.userId })
    .from(schema.vendors)
    .where(eq(schema.vendors.id, vendorId!))
    .limit(1);

  if (vendorRow?.userId) {
    void notificationsQueue
      .add('DISPUTE_RAISED_VENDOR', {
        type:    'DISPUTE_RAISED_VENDOR',
        userId:  vendorRow.userId,
        payload: { bookingId, vendorId: vendorId!, reason: input.reason },
      })
      .catch((e) => console.warn('[dispute] vendor notification queue error:', e));
  } else {
    console.warn('[dispute] vendor user lookup failed', { vendorId: vendorId! });
  }

  // Admin fan-out — replaces the broken `'admin'` sentinel pattern.
  void notifyAdmins('DISPUTE_NEEDS_REVIEW', {
    bookingId,
    customerId: userId,
    vendorId:   vendorId!,
    reason:     input.reason,
  }).catch((e) => console.warn('[dispute] admin notification fan-out error:', e));

  return { success: true, bookingId, status: 'DISPUTED' };
}

// ── resolveDispute ────────────────────────────────────────────────────────────

export type DisputeResolution = 'RELEASE' | 'REFUND' | 'SPLIT';

export interface ResolveDisputeBody {
  resolution:    DisputeResolution;
  splitRatio?:   number;
  resolutionId?: string;
}

export interface ResolveDisputeResult {
  success:    true;
  resolution: DisputeResolution;
  amounts: {
    vendor:   number;
    customer: number;
  };
}

export async function resolveDispute(
  adminUserId: string,
  bookingId: string,
  body: ResolveDisputeBody,
): Promise<ResolveDisputeResult> {
  // 1. Verify ADMIN role
  const [adminUser] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminUserId))
    .limit(1);

  if (!adminUser || adminUser.role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required');
  }

  // 2. Idempotency — generate or accept caller-supplied resolutionId
  const resolutionId = body.resolutionId ?? randomUUID();

  // 3. Fetch booking and assert DISPUTED
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error('Booking not found');
  }
  if (booking.status !== 'DISPUTED') {
    throw new Error(`Invalid state: booking status is ${booking.status}, must be DISPUTED`);
  }

  // 4. Fetch escrow account
  const [escrow] = await db
    .select()
    .from(schema.escrowAccounts)
    .where(eq(schema.escrowAccounts.bookingId, bookingId))
    .limit(1);

  if (!escrow) {
    throw new Error('Escrow account not found for booking');
  }

  // 5. Fetch latest payment for this booking
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.bookingId, bookingId))
    .limit(1);

  const escrowTotal = parseFloat(escrow.totalHeld ?? '0');
  const { resolution, splitRatio } = body;

  let vendorAmount   = 0;
  let customerAmount = 0;

  // 6. Idempotent INSERT into disputeResolutions — onConflictDoNothing on (bookingId, resolutionId)
  //    If insert returns no row, this is a duplicate replay — return stored result.
  const computedVendorAmount   = resolution === 'RELEASE' ? escrowTotal
                                : resolution === 'REFUND'  ? 0
                                : Math.round(escrowTotal * (splitRatio ?? 0));
  const computedCustomerAmount = escrowTotal - computedVendorAmount;

  const inserted = await db
    .insert(schema.disputeResolutions)
    .values({
      bookingId,
      resolutionId,
      outcome:        resolution,
      amountVendor:   String(computedVendorAmount),
      amountCustomer: String(computedCustomerAmount),
      resolvedBy:     adminUserId,
    })
    .onConflictDoNothing({ target: [schema.disputeResolutions.bookingId, schema.disputeResolutions.resolutionId] })
    .returning();

  if (inserted.length === 0) {
    // Duplicate idempotent replay — return previously stored row
    const [existing] = await db
      .select()
      .from(schema.disputeResolutions)
      .where(
        and(
          eq(schema.disputeResolutions.bookingId, bookingId),
          eq(schema.disputeResolutions.resolutionId, resolutionId),
        ),
      )
      .limit(1);

    return {
      success:    true,
      resolution: (existing?.outcome ?? resolution) as DisputeResolution,
      amounts: {
        vendor:   parseFloat(existing?.amountVendor ?? '0'),
        customer: parseFloat(existing?.amountCustomer ?? '0'),
      },
    };
  }

  // 7. Atomic optimistic lock — prevents double-resolution on concurrent admin clicks
  const lockResult = await db
    .update(schema.bookings)
    .set({ status: resolution === 'REFUND' ? 'CANCELLED' : 'COMPLETED', updatedAt: new Date() })
    .where(
      and(
        eq(schema.bookings.id, bookingId),
        eq(schema.bookings.status, 'DISPUTED'),
      ),
    )
    .returning({ id: schema.bookings.id });

  if (lockResult.length === 0) {
    throw new Error('DISPUTE_ALREADY_RESOLVED');
  }

  switch (resolution) {
    case 'RELEASE': {
      vendorAmount   = escrowTotal;
      customerAmount = 0;

      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(escrowTotal), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      });

      try {
        if (!env.USE_MOCK_SERVICES) {
          await transferToVendor(booking.vendorId, rupeesToPaise(escrowTotal));
        } else {
          logger.debug({ vendorId: booking.vendorId, amount: escrowTotal }, '[dispute:mock] transferToVendor');
        }
      } catch (e) {
        console.error(`[dispute] transferToVendor failed for booking ${bookingId}, setting RELEASE_PENDING:`, e);
        await db
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASE_PENDING' })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      }

      await appendAuditLog({
        eventType:  'DISPUTE_RESOLVED_RELEASE',
        entityType: 'booking',
        entityId:   bookingId,
        actorId:    adminUserId,
        payload:    { resolution, bookingId, vendorAmount, customerAmount, escrowTotal },
      });
      break;
    }

    case 'REFUND': {
      vendorAmount   = 0;
      customerAmount = escrowTotal;

      await db.transaction(async (tx) => {
        if (payment) {
          await tx
            .update(schema.payments)
            .set({ status: 'REFUNDED' })
            .where(eq(schema.payments.id, payment.id));
        }

        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'REFUNDED' })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      });

      try {
        if (payment?.razorpayPaymentId) {
          if (!env.USE_MOCK_SERVICES) {
            await createRefund(payment.razorpayPaymentId, rupeesToPaise(escrowTotal));
          } else {
            logger.debug({ paymentId: payment.razorpayPaymentId, amount: escrowTotal }, '[dispute:mock] createRefund');
          }
        }
      } catch (e) {
        console.error(`[dispute] createRefund failed for booking ${bookingId}, setting REFUND_PENDING:`, e);
        await db
          .update(schema.payments)
          .set({ status: 'REFUND_PENDING' })
          .where(eq(schema.payments.id, payment!.id));
      }

      await appendAuditLog({
        eventType:  'DISPUTE_RESOLVED_REFUND',
        entityType: 'booking',
        entityId:   bookingId,
        actorId:    adminUserId,
        payload:    { resolution, bookingId, vendorAmount, customerAmount, escrowTotal },
      });
      break;
    }

    case 'SPLIT': {
      if (splitRatio === undefined || splitRatio <= 0 || splitRatio >= 1) {
        throw new Error('splitRatio must be between 0 and 1 (exclusive) for SPLIT resolution');
      }

      vendorAmount   = Math.round(escrowTotal * splitRatio);
      customerAmount = escrowTotal - vendorAmount;

      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(vendorAmount), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      });

      try {
        if (!env.USE_MOCK_SERVICES) {
          await transferToVendor(booking.vendorId, rupeesToPaise(vendorAmount));
        } else {
          logger.debug({ vendorId: booking.vendorId, amount: vendorAmount }, '[dispute:mock] transferToVendor');
        }
      } catch (e) {
        console.error(`[dispute] SPLIT transferToVendor failed for booking ${bookingId}, setting RELEASE_PENDING:`, e);
        await db
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASE_PENDING' })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      }

      try {
        if (payment?.razorpayPaymentId && customerAmount > 0) {
          if (!env.USE_MOCK_SERVICES) {
            await createRefund(payment.razorpayPaymentId, rupeesToPaise(customerAmount));
          } else {
            logger.debug({ paymentId: payment.razorpayPaymentId, amount: customerAmount }, '[dispute:mock] createRefund');
          }
        }
      } catch (e) {
        console.error(`[dispute] SPLIT createRefund failed for booking ${bookingId}, setting REFUND_PENDING:`, e);
        if (payment) {
          await db
            .update(schema.payments)
            .set({ status: 'REFUND_PENDING' })
            .where(eq(schema.payments.id, payment.id));
        }
      }

      await appendAuditLog({
        eventType:  'DISPUTE_RESOLVED_SPLIT',
        entityType: 'booking',
        entityId:   bookingId,
        actorId:    adminUserId,
        payload:    { resolution, side: 'vendor', amount: vendorAmount, splitRatio, escrowTotal },
      });
      await appendAuditLog({
        eventType:  'DISPUTE_RESOLVED_SPLIT',
        entityType: 'booking',
        entityId:   bookingId,
        actorId:    adminUserId,
        payload:    { resolution, side: 'customer', amount: customerAmount, splitRatio, escrowTotal },
      });
      break;
    }

    default: {
      throw new Error(`Unknown resolution type: ${String(resolution)}`);
    }
  }

  void notificationsQueue
    .add('DISPUTE_RESOLVED', {
      type:    'DISPUTE_RESOLVED',
      userId:  booking.customerId,
      payload: {
        bookingId,
        customerId: booking.customerId,
        vendorId:   booking.vendorId,
        resolution,
        vendorAmount,
        customerAmount,
      },
    })
    .catch((e) => console.warn('[dispute] resolve notification queue error:', e));

  return { success: true, resolution, amounts: { vendor: vendorAmount, customer: customerAmount } };
}

// ── getDisputedBookings ───────────────────────────────────────────────────────

export interface DisputedBookingRow {
  bookingId:     string;
  customerId:    string;
  customerName:  string;
  vendorId:      string;
  totalAmount:   string;
  escrowHeld:    string;
  raisedAt:      Date;
  escrowStatus:  string;
  paymentId:     string | null;
}

export async function getDisputedBookings(adminUserId: string): Promise<DisputedBookingRow[]> {
  const [adminUser] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminUserId))
    .limit(1);

  if (!adminUser || adminUser.role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required');
  }

  const rows = await db
    .select({
      bookingId:    schema.bookings.id,
      customerId:   schema.bookings.customerId,
      customerName: schema.user.name,
      vendorId:     schema.bookings.vendorId,
      totalAmount:  schema.bookings.totalAmount,
      raisedAt:     schema.bookings.createdAt,
      escrowHeld:   schema.escrowAccounts.totalHeld,
      escrowStatus: schema.escrowAccounts.status,
      paymentId:    schema.payments.id,
    })
    .from(schema.bookings)
    .innerJoin(schema.escrowAccounts, eq(schema.escrowAccounts.bookingId, schema.bookings.id))
    .innerJoin(schema.user, eq(schema.user.id, schema.bookings.customerId))
    .leftJoin(
      schema.payments,
      and(
        eq(schema.payments.bookingId, schema.bookings.id),
        eq(schema.payments.status, 'CAPTURED'),
      ),
    )
    .where(eq(schema.bookings.status, 'DISPUTED'));

  return rows.map((r) => ({
    bookingId:    r.bookingId,
    customerId:   r.customerId,
    customerName: r.customerName,
    vendorId:     r.vendorId,
    totalAmount:  r.totalAmount as unknown as string,
    escrowHeld:   r.escrowHeld ?? '0',
    raisedAt:     r.raisedAt,
    escrowStatus: r.escrowStatus ?? 'DISPUTED',
    paymentId:    r.paymentId ?? null,
  }));
}
