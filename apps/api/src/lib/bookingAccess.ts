import { eq } from 'drizzle-orm';
import { bookings, vendors } from '@smartshaadi/db';
import { db } from './db.js';

export type BookingAccessOutcome =
  | { ok: true }
  | { ok: false; status: 404; code: 'NOT_FOUND'; message: string };

/**
 * Authorize booking-scoped read access.
 *
 * - ADMIN/SUPPORT → always allowed.
 * - Otherwise the caller must be the booking's customer OR the vendor that
 *   owns the booking (vendor.userId).
 *
 * Returns 404 (not 403) on access denial so the response cannot be used to
 * probe for booking existence.
 */
export async function authorizeBookingAccess(
  bookingId: string,
  userId: string,
  role: string,
): Promise<BookingAccessOutcome> {
  if (role === 'ADMIN' || role === 'SUPPORT') return { ok: true };

  const [row] = await db
    .select({
      customerId:    bookings.customerId,
      vendorOwnerId: vendors.userId,
    })
    .from(bookings)
    .leftJoin(vendors, eq(vendors.id, bookings.vendorId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Booking not found' };

  if (row.customerId === userId) return { ok: true };
  if (row.vendorOwnerId && row.vendorOwnerId === userId) return { ok: true };

  return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Booking not found' };
}
