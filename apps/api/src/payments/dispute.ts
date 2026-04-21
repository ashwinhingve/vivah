/**
 * Smart Shaadi — Dispute Service
 *
 * Handles the full escrow dispute state machine:
 *   raiseDispute    — customer raises a dispute; cancels pending Bull release job
 *   resolveDispute  — admin resolves: RELEASE | REFUND | SPLIT
 *   getDisputedBookings — admin lists all disputed bookings
 *
 * Invariants:
 *   - Bull escrow-release job is cancelled BEFORE status is updated to DISPUTED
 *   - audit_logs are APPEND-ONLY (hash-chain via appendAuditLog from payments/service.ts)
 *   - All queries filtered by userId; ADMIN check via user.role === 'ADMIN'
 *   - USE_MOCK_SERVICES guard on all Razorpay calls
 *
 * TODO (Phase 2): Add 'DISPUTE_RAISED' and 'DISPUTE_RESOLVED' to auditEventTypeEnum in schema.
 *   For now we use 'ESCROW_DISPUTED' for raise and 'ESCROW_RELEASED'/'REFUND_ISSUED' for resolve.
 */
import { eq, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor, createRefund } from '../lib/razorpay.js';
import { appendAuditLog } from './service.js';
import type { DisputeEscrowInput } from '@smartshaadi/schemas';

// ── Bull queue for escrow release (same name as bookings/service.ts producer) ──
const escrowReleaseQueue = new Queue('escrow-release', {
  connection: {
    url:                  env.REDIS_URL,
    enableOfflineQueue:   false,
    maxRetriesPerRequest: null as unknown as number,
  },
});

// ── Bull queue for notifications ─────────────────────────────────────────────
const notificationsQueue = new Queue('notifications', {
  connection: {
    url:                  env.REDIS_URL,
    enableOfflineQueue:   false,
    maxRetriesPerRequest: null as unknown as number,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Cancel any pending escrow-release job for this booking.
 * BullMQ jobs added with `add()` get an auto ID; the booking teammate doesn't set
 * a deterministic jobId. We scan for delayed jobs and remove the one whose data
 * matches the bookingId.
 *
 * Falls through silently if no job found — the escrowReleaseJob worker already
 * guards against releasing DISPUTED bookings, but cancelling early is safer.
 */
async function cancelEscrowReleaseJob(bookingId: string): Promise<void> {
  try {
    const delayed = await escrowReleaseQueue.getDelayed();
    for (const job of delayed) {
      if (job.data?.bookingId === bookingId) {
        await job.remove();
      }
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
  await cancelEscrowReleaseJob(bookingId);

  // 6. Drizzle transaction: update booking + escrow atomically
  await db.transaction(async (tx) => {
    await tx
      .update(schema.bookings)
      .set({ status: 'DISPUTED' })
      .where(eq(schema.bookings.id, bookingId));

    await tx
      .update(schema.escrowAccounts)
      .set({ status: 'DISPUTED' })
      .where(eq(schema.escrowAccounts.id, escrow.id));
  });

  // 7. Append audit log (AFTER status update)
  // TODO Phase 2: extend auditEventTypeEnum with 'DISPUTE_RAISED' — using 'ESCROW_DISPUTED' as closest existing value
  await appendAuditLog({
    eventType:  'ESCROW_DISPUTED',
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

  // 8. Enqueue notifications (vendor + admin) — non-blocking, fire-and-forget
  void notificationsQueue
    .add('DISPUTE_RAISED_VENDOR', {
      type:      'DISPUTE_RAISED_VENDOR',
      bookingId,
      vendorId:  booking.vendorId,
      reason:    input.reason,
    })
    .catch((e) => console.warn('[dispute] vendor notification queue error:', e));

  void notificationsQueue
    .add('DISPUTE_NEEDS_REVIEW', {
      type:      'DISPUTE_NEEDS_REVIEW',
      bookingId,
      customerId: userId,
      reason:    input.reason,
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

  switch (resolution) {
    case 'RELEASE': {
      // Transfer full escrow to vendor
      // IMPORTANT: Mock-safe — transferToVendor is guarded in razorpay.ts
      if (env.USE_MOCK_SERVICES) {
        console.info(`[dispute:mock] transferToVendor ${booking.vendorId} ₹${escrowTotal}`);
      } else {
        await transferToVendor(booking.vendorId, escrowTotal);
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(escrowTotal), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));

        await tx
          .update(schema.bookings)
          .set({ status: 'COMPLETED' })
          .where(eq(schema.bookings.id, bookingId));
      });

      vendorAmount   = escrowTotal;
      customerAmount = 0;

      // TODO Phase 2: use 'DISPUTE_RESOLVED_RELEASE' event; using 'ESCROW_RELEASED' for now
      await appendAuditLog({
        eventType:  'ESCROW_RELEASED',
        entityType: 'escrow',
        entityId:   escrow.id,
        actorId:    adminUserId,
        payload:    { resolution, bookingId, vendorAmount, customerAmount, escrowTotal },
      });
      break;
    }

    case 'REFUND': {
      // Refund full escrow to customer
      if (payment?.razorpayPaymentId) {
        if (env.USE_MOCK_SERVICES) {
          console.info(`[dispute:mock] createRefund payment ${payment.razorpayPaymentId} ₹${escrowTotal}`);
        } else {
          await createRefund(payment.razorpayPaymentId, escrowTotal);
        }
      }

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

        await tx
          .update(schema.bookings)
          .set({ status: 'CANCELLED' })
          .where(eq(schema.bookings.id, bookingId));
      });

      vendorAmount   = 0;
      customerAmount = escrowTotal;

      // TODO Phase 2: use 'DISPUTE_RESOLVED_REFUND' event; using 'REFUND_ISSUED' for now
      await appendAuditLog({
        eventType:  'REFUND_ISSUED',
        entityType: 'payment',
        entityId:   payment?.id ?? bookingId,
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
      customerAmount = Math.round((escrowTotal - vendorAmount) * 100) / 100;

      // Transfer vendor's share
      if (env.USE_MOCK_SERVICES) {
        console.info(`[dispute:mock] transferToVendor ${booking.vendorId} ₹${vendorAmount}`);
      } else {
        await transferToVendor(booking.vendorId, vendorAmount);
      }

      // Refund customer's share
      if (payment?.razorpayPaymentId && customerAmount > 0) {
        if (env.USE_MOCK_SERVICES) {
          console.info(`[dispute:mock] createRefund payment ${payment.razorpayPaymentId} ₹${customerAmount}`);
        } else {
          await createRefund(payment.razorpayPaymentId, customerAmount);
        }
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASED', released: String(vendorAmount), releasedAt: new Date() })
          .where(eq(schema.escrowAccounts.id, escrow.id));

        await tx
          .update(schema.bookings)
          .set({ status: 'COMPLETED' })
          .where(eq(schema.bookings.id, bookingId));
      });

      // Two audit logs for SPLIT — one per side
      // TODO Phase 2: use 'DISPUTE_RESOLVED_SPLIT_VENDOR'/'DISPUTE_RESOLVED_SPLIT_CUSTOMER'
      await appendAuditLog({
        eventType:  'ESCROW_RELEASED',
        entityType: 'escrow',
        entityId:   escrow.id,
        actorId:    adminUserId,
        payload:    { resolution, side: 'VENDOR', bookingId, vendorAmount, splitRatio, escrowTotal },
      });
      await appendAuditLog({
        eventType:  'REFUND_ISSUED',
        entityType: 'payment',
        entityId:   payment?.id ?? bookingId,
        actorId:    adminUserId,
        payload:    { resolution, side: 'CUSTOMER', bookingId, customerAmount, splitRatio, escrowTotal },
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
      type:       'DISPUTE_RESOLVED',
      bookingId,
      customerId: booking.customerId,
      vendorId:   booking.vendorId,
      resolution,
      vendorAmount,
      customerAmount,
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
