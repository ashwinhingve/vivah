/**
 * Booking state machine service.
 * Handles create / confirm / cancel / complete lifecycle + escrow scheduling.
 */

import { Queue } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import {
  bookings,
  escrowAccounts,
  payments,
  vendors,
} from '@smartshaadi/db';
import type { BookingSummary } from '@smartshaadi/types';
import type { CreateBookingInput } from '@smartshaadi/schemas';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { createRefund } from '../lib/razorpay.js';

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

// ── BullMQ queue for escrow release (48h delayed) ────────────────────────────

const escrowReleaseQueue = new Queue<EscrowReleaseJob>('queue:escrow-release', {
  connection: {
    url: env.REDIS_URL,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null as unknown as number,
  },
});

const notificationsQueue = new Queue<NotificationJob>('queue:notifications', {
  connection: {
    url: env.REDIS_URL,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null as unknown as number,
  },
});

export interface EscrowReleaseJob {
  escrowId:  string | null;
  bookingId: string;
  vendorId:  string;
  amount:    number;
}

export interface NotificationJob {
  userId:  string;
  type:    string;
  payload: Record<string, unknown>;
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
  // 1. Conflict check — same vendor + same eventDate with CONFIRMED status
  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, input.vendorId),
        eq(bookings.eventDate, input.eventDate),
        eq(bookings.status, 'CONFIRMED'),
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

  const [updated] = await db
    .update(bookings)
    .set({ status: 'CONFIRMED', updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    throw new BookingError('UPDATE_FAILED', 'Failed to confirm booking.');
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

  if (escrow?.status === 'HELD') {
    // Find the Razorpay payment ID for this booking
    const [payment] = await db
      .select({ id: payments.id, razorpayPaymentId: payments.razorpayPaymentId })
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .limit(1);

    if (!payment?.razorpayPaymentId) {
      throw new BookingError('REFUND_FAILED', 'Payment has not been captured — cannot issue refund.');
    }
    await createRefund(payment.razorpayPaymentId, parseAmount(escrow.totalHeld));
  }

  const [updated] = await db
    .update(bookings)
    .set({
      status:    'CANCELLED',
      notes:     reason ? `${booking.notes ?? ''}\nCancellation reason: ${reason}`.trim() : booking.notes,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId))
    .returning();

  if (!updated) {
    throw new BookingError('UPDATE_FAILED', 'Failed to cancel booking.');
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
    { delay: FORTY_EIGHT_HOURS_MS },
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

  if (role === 'customer') {
    rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, userId))
      .limit(limit)
      .offset(offset);
  } else {
    // Look up vendor record for this userId
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return { bookings: [], total: 0, page, limit };
    }

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
    total:    summaries.length,
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
