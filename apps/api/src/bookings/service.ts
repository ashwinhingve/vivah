/**
 * Booking state machine service.
 * Handles create / confirm / cancel / complete lifecycle + escrow scheduling.
 */

import { eq, and, desc, inArray, sql, type SQL } from 'drizzle-orm';
import {
  bookings,
  escrowAccounts,
  payments,
  vendors,
  bookingAddons,
  vendorReviews,
  vendorBlockedDates,
} from '@smartshaadi/db';
import type { BookingSummary, BookingAddon, BookingStatus } from '@smartshaadi/types';
import type { CreateBookingInput, RescheduleBookingInput } from '@smartshaadi/schemas';
import { db } from '../lib/db.js';
import { createRefund } from '../lib/razorpay.js';
import { rupeesToPaise } from '../lib/money.js';
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

// Postgres unique-violation. Translated to BOOKING_CONFLICT when the
// `booking_active_unique_idx` partial index trips — closes the
// READ-COMMITTED race where two concurrent createBooking transactions
// both pass the application-level conflict check.
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === '23505'
  );
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
  const [vendor] = await db
    .select({ businessName: vendors.businessName })
    .from(vendors)
    .where(eq(vendors.id, row.vendorId))
    .limit(1);

  const [escrow] = await db
    .select({ totalHeld: escrowAccounts.totalHeld })
    .from(escrowAccounts)
    .where(eq(escrowAccounts.bookingId, row.id))
    .limit(1);

  const addonRows = await db
    .select()
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, row.id));

  const addons: BookingAddon[] = addonRows.map((a) => ({
    id:        a.id,
    name:      a.name,
    quantity:  a.quantity,
    unitPrice: parseAmount(a.unitPrice),
    notes:     a.notes,
  }));

  const [reviewRow] = await db
    .select({ id: vendorReviews.id })
    .from(vendorReviews)
    .where(eq(vendorReviews.bookingId, row.id))
    .limit(1);

  return {
    id:           row.id,
    vendorId:     row.vendorId,
    vendorName:   vendor?.businessName ?? 'Unknown Vendor',
    serviceId:    row.serviceId ?? null,
    eventDate:    row.eventDate,
    ceremonyType: row.ceremonyType,
    status:       row.status as BookingSummary['status'],
    totalAmount:  parseAmount(row.totalAmount),
    escrowAmount: escrow ? parseAmount(escrow.totalHeld) : null,
    createdAt:    row.createdAt.toISOString(),
    packageName:  row.packageName,
    packagePrice: row.packagePrice != null ? parseAmount(row.packagePrice) : null,
    guestCount:   row.guestCount,
    eventLocation: row.eventLocation,
    proposedDate: row.proposedDate ?? null,
    proposedBy:   row.proposedBy ?? null,
    proposedReason: row.proposedReason ?? null,
    addons,
    hasReview:    reviewRow != null,
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
  // Conflict + blocked-date check + insert all run inside the same
  // transaction. The application-level conflict check gives a clean error
  // for the common case; the `booking_active_unique_idx` partial index
  // closes the residual READ-COMMITTED race where two concurrent
  // transactions both read zero conflicts before either inserts. The
  // 23505 thrown by the loser is translated to BOOKING_CONFLICT below.
  let inserted;
  try {
    inserted = await db.transaction(async (tx) => {
    const conflicts = await tx
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

    const blocked = await tx
      .select({ id: vendorBlockedDates.id, reason: vendorBlockedDates.reason })
      .from(vendorBlockedDates)
      .where(and(
        eq(vendorBlockedDates.vendorId, input.vendorId),
        eq(vendorBlockedDates.date, input.eventDate),
      ))
      .limit(1);

    if (blocked.length > 0) {
      throw new BookingError(
        'BOOKING_CONFLICT',
        blocked[0]?.reason ? `Vendor unavailable: ${blocked[0]?.reason}` : 'Vendor is unavailable on this date.',
      );
    }

    const [b] = await tx
      .insert(bookings)
      .values({
        customerId,
        vendorId:      input.vendorId,
        serviceId:     input.serviceId ?? null,
        eventDate:     input.eventDate,
        ceremonyType:  (input.ceremonyType as typeof bookings.$inferInsert['ceremonyType']) ?? 'WEDDING',
        status:        'PENDING',
        totalAmount:   String(input.totalAmount),
        notes:         input.notes ?? null,
        packageName:   input.packageName ?? null,
        packagePrice:  input.packagePrice != null ? String(input.packagePrice) : null,
        guestCount:    input.guestCount ?? null,
        eventLocation: input.eventLocation ?? null,
      })
      .returning();
    if (!b) throw new BookingError('INSERT_FAILED', 'Failed to create booking.');

    if (input.addons && input.addons.length > 0) {
      await tx.insert(bookingAddons).values(
        input.addons.map((a) => ({
          bookingId: b.id,
          name:      a.name,
          quantity:  a.quantity,
          unitPrice: String(a.unitPrice),
          notes:     a.notes ?? null,
        })),
      );
    }

    return b;
  });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new BookingError(
        'BOOKING_CONFLICT',
        'This vendor is already booked for that date.',
      );
    }
    throw e;
  }

  // Notify vendor
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
 * Either the customer or vendor proposes a new event date. The booking stays
 * in its current status (PENDING/CONFIRMED) until the counterparty accepts
 * via {@link acceptReschedule} or rejects via {@link rejectReschedule}.
 */
export async function proposeReschedule(
  userId:    string,
  bookingId: string,
  input:     RescheduleBookingInput,
): Promise<BookingSummary> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new BookingError('NOT_FOUND', 'Booking not found.');

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);

  const isCustomer = booking.customerId === userId;
  const isVendor   = vendor?.userId === userId;
  if (!isCustomer && !isVendor) {
    throw new BookingError('FORBIDDEN', 'You are not authorised to reschedule this booking.');
  }

  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw new BookingError('INVALID_STATE', `Cannot reschedule a ${booking.status} booking.`);
  }

  // Conflict check on the proposed date
  const conflicts = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, booking.vendorId),
      eq(bookings.eventDate, input.proposedDate),
      inArray(bookings.status, ['PENDING', 'CONFIRMED']),
    ))
    .limit(1);
  if (conflicts.length > 0 && conflicts[0]?.id !== bookingId) {
    throw new BookingError('BOOKING_CONFLICT', 'Vendor already booked on the proposed date.');
  }

  const [updated] = await db
    .update(bookings)
    .set({
      proposedDate:   input.proposedDate,
      proposedBy:     userId,
      proposedReason: input.reason,
      proposedAt:     new Date(),
      updatedAt:      new Date(),
    })
    .where(eq(bookings.id, bookingId))
    .returning();
  if (!updated) throw new BookingError('UPDATE_FAILED', 'Failed to propose reschedule.');

  const targetUserId = isCustomer ? vendor?.userId : booking.customerId;
  if (targetUserId) {
    await notificationsQueue.add('SYSTEM', {
      userId:  targetUserId,
      type:    'SYSTEM',
      payload: { kind: 'reschedule-proposed', bookingId, proposedDate: input.proposedDate },
    });
  }

  return toBookingSummary(updated);
}

export async function acceptReschedule(
  userId:    string,
  bookingId: string,
): Promise<BookingSummary> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new BookingError('NOT_FOUND', 'Booking not found.');
  if (!booking.proposedDate || !booking.proposedBy) {
    throw new BookingError('INVALID_STATE', 'No active reschedule proposal.');
  }

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);
  const isCustomer = booking.customerId === userId;
  const isVendor   = vendor?.userId === userId;
  if (!isCustomer && !isVendor) {
    throw new BookingError('FORBIDDEN', 'Not authorised.');
  }
  // The party that did NOT propose must accept
  if (booking.proposedBy === userId) {
    throw new BookingError('FORBIDDEN', 'Counterparty must accept the reschedule.');
  }

  // The eventDate change can trip the partial unique index if a new
  // booking grabbed the proposed slot between propose-time conflict-check
  // and accept-time. Translate 23505 → BOOKING_CONFLICT.
  let updated;
  try {
    [updated] = await db
      .update(bookings)
      .set({
        eventDate:      booking.proposedDate,
        proposedDate:   null,
        proposedBy:     null,
        proposedReason: null,
        proposedAt:     null,
        updatedAt:      new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new BookingError(
        'BOOKING_CONFLICT',
        'Vendor became unavailable on the proposed date before you accepted.',
      );
    }
    throw e;
  }
  if (!updated) throw new BookingError('UPDATE_FAILED', 'Failed to accept reschedule.');

  return toBookingSummary(updated);
}

export async function rejectReschedule(
  userId:    string,
  bookingId: string,
): Promise<BookingSummary> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new BookingError('NOT_FOUND', 'Booking not found.');
  if (!booking.proposedDate) throw new BookingError('INVALID_STATE', 'No active reschedule proposal.');

  const [vendor] = await db
    .select({ userId: vendors.userId })
    .from(vendors)
    .where(eq(vendors.id, booking.vendorId))
    .limit(1);
  const isCustomer = booking.customerId === userId;
  const isVendor   = vendor?.userId === userId;
  if (!isCustomer && !isVendor) {
    throw new BookingError('FORBIDDEN', 'Not authorised.');
  }

  const [updated] = await db
    .update(bookings)
    .set({
      proposedDate:   null,
      proposedBy:     null,
      proposedReason: null,
      proposedAt:     null,
      updatedAt:      new Date(),
    })
    .where(eq(bookings.id, bookingId))
    .returning();
  if (!updated) throw new BookingError('UPDATE_FAILED', 'Failed to reject reschedule.');

  return toBookingSummary(updated);
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
      await createRefund(refundAttempt.paymentId, rupeesToPaise(refundAttempt.amount));
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

export interface BookingListOptions {
  status?:   BookingStatus | 'ALL';
  timeline?: 'upcoming' | 'past' | 'all';
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
  options: BookingListOptions = {},
): Promise<BookingListResult> {
  const offset = (page - 1) * limit;

  const conds: SQL[] = [];
  if (role === 'customer') {
    conds.push(eq(bookings.customerId, userId));
  } else {
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);
    if (!vendor) return { bookings: [], total: 0, page, limit };
    conds.push(eq(bookings.vendorId, vendor.id));
  }

  if (options.status && options.status !== 'ALL') {
    conds.push(eq(bookings.status, options.status));
  }
  if (options.timeline === 'upcoming') {
    conds.push(sql`${bookings.eventDate} >= CURRENT_DATE`);
  } else if (options.timeline === 'past') {
    conds.push(sql`${bookings.eventDate} < CURRENT_DATE`);
  }

  const where = conds.length > 1 ? and(...conds) : conds[0]!;

  const [countRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(bookings)
    .where(where);
  const total = Number(countRow?.count ?? 0);

  const rows = await db
    .select()
    .from(bookings)
    .where(where)
    .orderBy(desc(bookings.eventDate))
    .limit(limit)
    .offset(offset);

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
