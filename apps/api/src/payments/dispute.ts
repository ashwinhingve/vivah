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
 *   - Optimistic locking via atomic conditional update prevents double-spend on concurrent calls
 *   - DB transaction commits FIRST; Razorpay call comes second — failure sets *_PENDING, no rollback
 *   - audit_logs are APPEND-ONLY (hash-chain via appendAuditLog from payments/service.ts)
 *   - All queries filtered by userId; ADMIN check via user.role === 'ADMIN'
 *   - USE_MOCK_SERVICES guard on all Razorpay calls
 */
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor, createRefund } from '../lib/razorpay.js';
import { appendAuditLog } from './service.js';
import { escrowReleaseQueue, notificationsQueue } from '../infrastructure/redis/queues.js';
import type { DisputeEscrowInput } from '@smartshaadi/schemas';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Cancel any pending escrow-release job for this booking using the deterministic jobId.
 * Phase 0 added `jobId: \`escrow-release:\${bookingId}\`` to the producer in bookings/service.ts.
 * Using getJob() covers ALL states (delayed, waiting, active) — unlike getDelayed() scan.
 *
 * Falls through silently if no job found — the escrowReleaseJob worker already
 * guards against releasing DISPUTED bookings, but cancelling early is safer.
 */
async function cancelEscrowReleaseJob(bookingId: string): Promise<void> {
  try {
    const job = await escrowReleaseQueue.getJob(`escrow-release-${bookingId}`);
    if (job) {
      await job.remove();
    }
  } catch (e) {
    // Non-fatal — worker has its own DISPUTED guard
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
  // 1. Fetch booking
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error('Booking not found');
  }

  // 2. Verify ownership
  if (booking.customerId !== userId) {
    throw new Error('Forbidden: booking does not belong to this user');
  }

  // 3. Verify booking is in a disputable state
  if (booking.status !== 'CONFIRMED' && booking.status !== 'COMPLETED') {
    throw new Error(`Invalid state: booking status is ${booking.status}, must be CONFIRMED or COMPLETED`);
  }

  // 4. Fetch escrow account
  const [escrow] = await db
    .select()
    .from(schema.escrowAccounts)
    .where(eq(schema.escrowAccounts.bookingId, bookingId))
    .limit(1);

  if (!escrow || escrow.status !== 'HELD') {
    throw new Error(`Invalid state: escrow status is ${escrow?.status ?? 'missing'}, must be HELD`);
  }

  // 5. CRITICAL: Cancel pending Bull escrow-release job FIRST (before status update)
  //    Uses deterministic jobId `escrow-release:${bookingId}` — covers all job states
  await cancelEscrowReleaseJob(bookingId);

  // 6. Atomic conditional update — optimistic lock prevents double-dispute
  const updated = await db
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

  // 7. Update escrow status in its own atomic update
  await db
    .update(schema.escrowAccounts)
    .set({ status: 'DISPUTED' })
    .where(eq(schema.escrowAccounts.id, escrow.id));

  // 8. Append audit log (AFTER status update) — new enum values
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

  // 9. Enqueue notifications (vendor + admin) — non-blocking, fire-and-forget
  void notificationsQueue
    .add('DISPUTE_RAISED_VENDOR', {
      type:      'DISPUTE_RAISED_VENDOR',
      userId:    booking.vendorId,
      payload:   { bookingId, vendorId: booking.vendorId, reason: input.reason },
    })
    .catch((e) => console.warn('[dispute] vendor notification queue error:', e));

  void notificationsQueue
    .add('DISPUTE_NEEDS_REVIEW', {
      type:    'DISPUTE_NEEDS_REVIEW',
      userId:  userId,
      payload: { bookingId, customerId: userId, reason: input.reason },
    })
    .catch((e) => console.warn('[dispute] admin notification queue error:', e));

  return { success: true, bookingId, status: 'DISPUTED' };
}

// ── resolveDispute ────────────────────────────────────────────────────────────

export type DisputeResolution = 'RELEASE' | 'REFUND' | 'SPLIT';

export interface ResolveDisputeBody {
  resolution:   DisputeResolution;
  splitRatio?:  number; // 0 < splitRatio < 1 — vendor's share (required for SPLIT)
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
  // 1. Fetch admin user and verify ADMIN role
  const [adminUser] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminUserId))
    .limit(1);

  if (!adminUser || adminUser.role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required');
  }

  // 2. Fetch booking and assert DISPUTED
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

  // 3. Fetch escrow account
  const [escrow] = await db
    .select()
    .from(schema.escrowAccounts)
    .where(eq(schema.escrowAccounts.bookingId, bookingId))
    .limit(1);

  if (!escrow) {
    throw new Error('Escrow account not found for booking');
  }

  // 4. Fetch latest payment for this booking
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.bookingId, bookingId))
    .limit(1);

  const escrowTotal = parseFloat(escrow.totalHeld ?? '0');
  const { resolution, splitRatio } = body;

  let vendorAmount   = 0;
  let customerAmount = 0;

  // 5. Atomic optimistic lock — prevents double-resolution on concurrent admin clicks
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

      // 6a. DB transaction: update escrow RELEASED (booking already updated above)
      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(escrowTotal), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      });

      // 7a. Razorpay AFTER DB commits — if it fails, set RELEASE_PENDING for reconciliation
      try {
        if (!env.USE_MOCK_SERVICES) {
          await transferToVendor(booking.vendorId, escrowTotal);
        } else {
          console.info(`[dispute:mock] transferToVendor ${booking.vendorId} ₹${escrowTotal}`);
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

      // 6b. DB transaction: update escrow + payment REFUNDED (booking already updated above)
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

      // 7b. Razorpay AFTER DB commits — if it fails, set REFUND_PENDING for reconciliation
      try {
        if (payment?.razorpayPaymentId) {
          if (!env.USE_MOCK_SERVICES) {
            await createRefund(payment.razorpayPaymentId, escrowTotal);
          } else {
            console.info(`[dispute:mock] createRefund payment ${payment.razorpayPaymentId} ₹${escrowTotal}`);
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

      vendorAmount   = Math.round(escrowTotal * splitRatio * 100) / 100;
      customerAmount = escrowTotal - vendorAmount; // avoid re-multiply drift

      // 6c. DB transaction: update escrow (booking already updated above)
      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(vendorAmount), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      });

      // 7c. Transfer vendor's share — DB first, Razorpay second
      try {
        if (!env.USE_MOCK_SERVICES) {
          await transferToVendor(booking.vendorId, vendorAmount);
        } else {
          console.info(`[dispute:mock] transferToVendor ${booking.vendorId} ₹${vendorAmount}`);
        }
      } catch (e) {
        console.error(`[dispute] SPLIT transferToVendor failed for booking ${bookingId}, setting RELEASE_PENDING:`, e);
        await db
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASE_PENDING' })
          .where(eq(schema.escrowAccounts.id, escrow.id));
      }

      // Refund customer's share
      try {
        if (payment?.razorpayPaymentId && customerAmount > 0) {
          if (!env.USE_MOCK_SERVICES) {
            await createRefund(payment.razorpayPaymentId, customerAmount);
          } else {
            console.info(`[dispute:mock] createRefund payment ${payment.razorpayPaymentId} ₹${customerAmount}`);
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

      // Two audit logs for SPLIT — both use bookingId as entityId for tamper-detectability
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

  // Notify both parties
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
  // 1. Assert ADMIN
  const [adminUser] = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminUserId))
    .limit(1);

  if (!adminUser || adminUser.role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required');
  }

  // 2. SELECT disputed bookings joined with escrow, payments, and customer user
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
