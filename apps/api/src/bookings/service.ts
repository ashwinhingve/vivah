/**
 * Booking state machine service.
 * Handles create / confirm / cancel / complete lifecycle + escrow scheduling.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  bookings,
  escrowAccounts,
  payments,
  vendors,
} from '@smartshaadi/db';
import type { BookingSummary } from '@smartshaadi/types';
import type { CreateBookingInput } from '@smartshaadi/schemas';
import { db } from '../lib/db.js';
import { createRefund } from '../lib/razorpay.js';
import {
  escrowReleaseQueue,
  notificationsQueue,
  DEFAULT_JOB_OPTS,
} from '../infrastructure/redis/queues.js';

// ── Error codes ───────────────────────────────────────────────────────────────

export class BookingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

// notificationsQueue + escrowReleaseQueue are shared singletons exported from
// infrastructure/redis/queues.ts — never re-instantiate per-module.

export interface EscrowReleaseJob {
  escrowId:  string | null;
  bookingId: string;
  vendorId:  string;
  amount:    number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAmount(raw: string | null): number {
  return raw ? parseFloat(raw) : 0;
}

async function toBookingSummary(
  row: typeof bookings.$inferSelect,
): Promise<BookingSummary> {
  // Fetch vendor name
  const [vendor] = await db
    .select({ businessName: vendors.businessName })
    .from(vendors)
    .where(eq(vendors.id, row.vendorId))
    .limit(1);

  // Fetch escrow if any
  const [escrow] = await db
    .select({ totalHeld: escrowAccounts.totalHeld })
    .from(escrowAccounts)
    .where(eq(escrowAccounts.bookingId, row.id))
    .limit(1);

  return {
    id:           row.id,
    vendorId:     row.vendorId,
    vendorName:   vendor?.businessName ?? 'Unknown Vendor',
    serviceId:    row.serviceId ?? null,
    eventDate:    row.eventDate,
    status:       row.status as BookingSummary['status'],
    totalAmount:  parseAmount(row.totalAmount),
    escrowAmount: escrow ? parseAmount(escrow.totalHeld) : null,
    createdAt:    row.createdAt.toISOString(),
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a new booking for a customer.
 * Guards: conflict check (same vendor + same eventDate + CONFIRMED status).
 */
export async function createBooking(
  customerId: string,
  input: CreateBookingInput,
): Promise<BookingSummary> {
  // 1. Conflict check — same vendor + same eventDate already held (PENDING or
  // CONFIRMED). A vendor cannot be double-booked even if the first request
  // hasn't been confirmed yet.
  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, input.vendorId),
        eq(bookings.eventDate, input.eventDate),
        inArray(bookings.status, ['PENDING', 'CONFIRMED']),
      ),
    )
    .limit(1);

  if (conflicts.length > 0) {
    throw new BookingError(
      'BOOKING_CONFLICT',
      'This vendor is already booked for that date.',
    );
  }

  // 2. Insert booking
  const [inserted] = await db
    .insert(bookings)
    .values({
      customerId,
      vendorId:     input.vendorId,
      serviceId:    input.serviceId ?? null,
      eventDate:    input.eventDate,
      ceremonyType: (input.ceremonyType as typeof bookings.$inferInsert['ceremonyType']) ?? 'WEDDING',
      status:       'PENDING',
      totalAmount:  String(input.totalAmount),
      notes:        input.notes ?? null,
    })
    .returning();

  if (!inserted) {
    throw new BookingError('INSERT_FAILED', 'Failed to create booking.');
  }

  // 3. Notify vendor of new booking request
  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, input.vendorId))
    .limit(1);

  if (vendor) {
    await notificationsQueue.add('NEW_BOOKING_REQUEST', {
      userId:  vendor.userId,
      type:    'NEW_BOOKING_REQUEST',
      payload: { bookingId: inserted.id, customerId },
    });
  }

  return toBookingSummary(inserted);
}

/**
 * Vendor confirms a PENDING booking.
 * `userId` is the auth user's id. We resolve the vendor record first,
 * then verify the booking's vendorId matches.
 */
export async function confirmBooking(
  userId:    string,
  bookingId: string,
): Promise<BookingSummary> {
  // Resolve the vendor record for this userId
  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (!vendor) {
    throw new BookingError('FORBIDDEN', 'No vendor account found for this user.');
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingError('NOT_FOUND', 'Booking not found.');
  }

  if (booking.vendorId !== vendor.id) {
    throw new BookingError('FORBIDDEN', 'You are not authorised to confirm this booking.');
  }

  if (booking.status !== 'PENDING') {
    throw new BookingError('INVALID_STATE', `Cannot confirm a booking in ${booking.status} state.`);
  }

  // Optimistic lock — only transition when still PENDING. A concurrent confirm
  // on the same booking will update zero rows and the second caller errors.
  const [updated] = await db
    .update(bookings)
    .set({ status: 'CONFIRMED', updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'PENDING')))
    .returning();

  if (!updated) {
    throw new BookingError('CONCURRENT_UPDATE', 'Booking was already confirmed by another request.');
  }

  // Notify customer
  await notificationsQueue.add('BOOKING_CONFIRMED', {
    userId:  booking.customerId,
    type:    'BOOKING_CONFIRMED',
    payload: { bookingId },
  });

  return toBookingSummary(updated);
}

/**
 * Cancel a booking. Caller must be the customer OR the vendor.
 * If escrow is HELD, issues a refund via Razorpay.
 */
export async function cancelBooking(
  userId: string,
  bookingId: string,
  reason?: string,
): Promise<BookingSummary> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingError('NOT_FOUND', 'Booking not found.');
  }

  // Verify caller is customer or vendor (look up vendor record by userId)
  const [vendor] = await db
    .select({ id: vendors.id, userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);

  const isCustomer = booking.customerId === userId;
  const isVendor   = vendor?.userId === userId;

  if (!isCustomer && !isVendor) {
    throw new BookingError('FORBIDDEN', 'You are not authorised to cancel this booking.');
  }

  if (booking.status === 'CANCELLED') {
    throw new BookingError('INVALID_STATE', 'Booking is already cancelled.');
  }

  if (booking.status === 'COMPLETED') {
    throw new BookingError('INVALID_STATE', 'Cannot cancel a completed booking.');
  }

  // Check escrow account — if HELD, issue refund
  const [escrow] = await db
    .select({ id: escrowAccounts.id, totalHeld: escrowAccounts.totalHeld, status: escrowAccounts.status })
    .from(escrowAccounts)
    .where(eq(escrowAccounts.bookingId, bookingId))
    .limit(1);

  // Cancel flow — DB updates wrapped in a single transaction so the booking
  // always reflects escrow state. If the Razorpay refund call fails the DB
  // still records REFUND_PENDING + CANCELLED and the payment stays capturable
  // via admin retry, instead of leaving the booking un-cancelled and the user
  // unable to try again.
  let refundAttempt: { paymentId: string; amount: number } | null = null;

  if (escrow?.status === 'HELD') {
    const [payment] = await db
      .select({ id: payments.id, razorpayPaymentId: payments.razorpayPaymentId })
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .limit(1);

    if (!payment?.razorpayPaymentId) {
      throw new BookingError('REFUND_FAILED', 'Payment has not been captured — cannot issue refund.');
    }
    refundAttempt = {
      paymentId: payment.razorpayPaymentId,
      amount:    parseAmount(escrow.totalHeld),
    };
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(bookings)
      .set({
        status:    'CANCELLED',
        notes:     reason ? `${booking.notes ?? ''}\nCancellation reason: ${reason}`.trim() : booking.notes,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    if (escrow?.id && escrow.status === 'HELD') {
      // Optimistically mark escrow as REFUND_PENDING; flip to RELEASED on
      // successful Razorpay refund call below.
      await tx
        .update(escrowAccounts)
        .set({ status: 'REFUND_PENDING' })
        .where(eq(escrowAccounts.id, escrow.id));
    }

    return row;
  });

  if (!updated) {
    throw new BookingError('UPDATE_FAILED', 'Failed to cancel booking.');
  }

  // Razorpay call outside the transaction — network I/O should never hold a DB lock.
  if (refundAttempt && escrow?.id) {
    try {
      await createRefund(refundAttempt.paymentId, refundAttempt.amount);
      await db
        .update(escrowAccounts)
        .set({ status: 'RELEASED', released: String(refundAttempt.amount), releasedAt: new Date() })
        .where(eq(escrowAccounts.id, escrow.id));
    } catch (e) {
      // Booking stays CANCELLED + escrow REFUND_PENDING — surface so admin retry can act.
      console.error('[bookings/cancel] Razorpay refund failed — escrow left REFUND_PENDING:', e);
    }
  }

  return toBookingSummary(updated);
}

/**
 * Mark a booking as COMPLETED and schedule escrow release in 48 hours.
 */
export async function completeBooking(userId: string, bookingId: string): Promise<BookingSummary> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingError('NOT_FOUND', 'Booking not found.');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new BookingError(
      'INVALID_STATE',
      `Cannot complete a booking in ${booking.status} state. Must be CONFIRMED.`,
    );
  }

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);

  if (vendor?.userId !== userId) {
    throw new BookingError('FORBIDDEN', 'Only the booking vendor can mark a booking as complete.');
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: 'COMPLETED', updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    throw new BookingError('UPDATE_FAILED', 'Failed to complete booking.');
  }

  // Fetch escrow account if it exists
  const [escrow] = await db
    .select({ id: escrowAccounts.id, totalHeld: escrowAccounts.totalHeld })
    .from(escrowAccounts)
    .where(eq(escrowAccounts.bookingId, bookingId))
    .limit(1);

  const escrowAmount = escrow
    ? parseAmount(escrow.totalHeld)
    : parseAmount(booking.totalAmount) * 0.5;

  // Enqueue delayed escrow release — exactly 48 hours
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  await escrowReleaseQueue.add(
    'release-escrow',
    {
      escrowId:  escrow?.id ?? null,
      bookingId,
      vendorId:  booking.vendorId,
      amount:    escrowAmount,
    },
    {
      delay: FORTY_EIGHT_HOURS_MS,
      jobId: `escrow-release-${bookingId}`,
      ...DEFAULT_JOB_OPTS,
    },
  );

  return toBookingSummary(updated);
}

export interface BookingListResult {
  bookings: BookingSummary[];
  total:    number;
  page:     number;
  limit:    number;
}

/**
 * Get paginated list of bookings for a user.
 * Role 'customer' → filter by customerId.
 * Role 'vendor'   → look up vendor record by userId, filter by vendorId.
 */
export async function getBookings(
  userId: string,
  role:   'customer' | 'vendor',
  page  = 1,
  limit = 10,
): Promise<BookingListResult> {
  const offset = (page - 1) * limit;

  let rows: (typeof bookings.$inferSelect)[];
  let total = 0;

  if (role === 'customer') {
    const [countRow] = await db
      .select({ count: sql<string>`count(*)` })
      .from(bookings)
      .where(eq(bookings.customerId, userId));
    total = Number(countRow?.count ?? 0);

    rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, userId))
      .limit(limit)
      .offset(offset);
  } else {
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return { bookings: [], total: 0, page, limit };
    }

    const [countRow] = await db
      .select({ count: sql<string>`count(*)` })
      .from(bookings)
      .where(eq(bookings.vendorId, vendor.id));
    total = Number(countRow?.count ?? 0);

    rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.vendorId, vendor.id))
      .limit(limit)
      .offset(offset);
  }

  const summaries = await Promise.all(rows.map(toBookingSummary));

  return {
    bookings: summaries,
    total,
    page,
    limit,
  };
}

/**
 * Get a single booking, verifying the caller is the customer or vendor.
 */
export async function getBooking(
  userId:    string,
  bookingId: string,
): Promise<BookingSummary & { paymentStatus: string | null }> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new BookingError('NOT_FOUND', 'Booking not found.');
  }

  // Verify access — customer or vendor
  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);

  const isCustomer = booking.customerId === userId;
  const isVendor   = vendor?.userId === userId;

  if (!isCustomer && !isVendor) {
    throw new BookingError('FORBIDDEN', 'Access denied to this booking.');
  }

  const [payment] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);

  const summary = await toBookingSummary(booking);

  return {
    ...summary,
    paymentStatus: payment?.status ?? null,
  };
}
