/**
 * Smart Shaadi — Rental Service
 *
 * Handles rental item catalogue and booking lifecycle.
 *
 * Rule 12 note: rental_items.vendorId → vendors.id (uuid)
 *               rental_bookings.customerId → user.id (TEXT) — passes through directly
 *               vendors.userId → user.id (TEXT) — no profile-keyed columns involved here
 */

import { and, eq, inArray, lte, gte, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  rentalItems,
  rentalBookings,
  vendors,
} from '@smartshaadi/db';
import type {
  RentalItem,
  RentalBookingSummary,
} from '@smartshaadi/types';
import type {
  RentalListQuery,
  CreateRentalItemInput,
  CreateRentalBookingInput,
} from '@smartshaadi/schemas';

// ── Typed error factory ───────────────────────────────────────────────────────

function makeError(code: string, message: string, status: number): Error & { code: string; status: number } {
  const e = new Error(message) as Error & { code: string; status: number };
  e.code   = code;
  e.status = status;
  return e;
}

// ── Row → domain mappers ──────────────────────────────────────────────────────

interface RentalItemRow {
  id:          string;
  vendorId:    string;
  name:        string;
  description: string | null;
  category:    string;
  pricePerDay: string;
  deposit:     string;
  stockQty:    number;
  r2ImageKeys: string[] | null;
  isActive:    boolean;
}

interface RentalBookingRow {
  id:           string;
  rentalItemId: string;
  customerId:   string;
  fromDate:     string;
  toDate:       string;
  quantity:     number;
  totalAmount:  string;
  depositPaid:  string;
  status:       string;
  notes:        string | null;
  createdAt:    Date;
  updatedAt:    Date;
}

function toRentalItem(row: RentalItemRow, availableQty?: number): RentalItem {
  return {
    id:           row.id,
    vendorId:     row.vendorId,
    name:         row.name,
    description:  row.description,
    category:     row.category as RentalItem['category'],
    pricePerDay:  parseFloat(row.pricePerDay),
    deposit:      parseFloat(row.deposit),
    stockQty:     row.stockQty,
    availableQty: availableQty ?? row.stockQty,
    imageKeys:    row.r2ImageKeys ?? [],
    isActive:     row.isActive,
  };
}

function toBookingSummary(row: RentalBookingRow & { itemName?: string }): RentalBookingSummary {
  return {
    id:          row.id,
    itemId:      row.rentalItemId,
    itemName:    row.itemName ?? '',
    fromDate:    row.fromDate,
    toDate:      row.toDate,
    quantity:    row.quantity,
    totalAmount: parseFloat(row.totalAmount),
    depositPaid: parseFloat(row.depositPaid),
    status:      row.status as RentalBookingSummary['status'],
  };
}

// ── 1) listRentalItems ────────────────────────────────────────────────────────

export async function listRentalItems(query: RentalListQuery): Promise<{
  items: RentalItem[];
  meta: { page: number; limit: number; total: number };
}> {
  const { page, limit, category, vendorId, fromDate, toDate } = query;
  const offset = (page - 1) * limit;

  // Build base WHERE conditions
  const conditions = [eq(rentalItems.isActive, true)];

  if (category) {
    conditions.push(eq(rentalItems.category, category as RentalItem['category']));
  }
  if (vendorId) {
    conditions.push(eq(rentalItems.vendorId, vendorId));
  }

  // Fetch all candidates matching base filters (we'll post-filter on availability)
  const baseWhere = and(...conditions);

  // Count query (pre-filter — will be corrected after availability check)
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rentalItems)
    .where(baseWhere);
  const rawTotal = countResult[0]?.count ?? 0;

  // Fetch rows
  const rows = await db
    .select()
    .from(rentalItems)
    .where(baseWhere)
    .limit(limit)
    .offset(offset);

  // Availability filter: if both dates provided, compute availableQty per item
  let filteredRows = rows as RentalItemRow[];
  const availabilityMap = new Map<string, number>();

  if (fromDate && toDate) {
    // For each item, sum overlapping active booking quantities
    const ACTIVE_STATUSES: Array<'PENDING' | 'CONFIRMED' | 'ACTIVE'> = ['PENDING', 'CONFIRMED', 'ACTIVE'];
    const itemIds = rows.map((r) => r.id);

    if (itemIds.length > 0) {
      const reservedRows = await db
        .select({
          rentalItemId: rentalBookings.rentalItemId,
          reserved:     sql<number>`coalesce(sum(${rentalBookings.quantity}), 0)::int`,
        })
        .from(rentalBookings)
        .where(
          and(
            inArray(rentalBookings.rentalItemId, itemIds),
            inArray(rentalBookings.status, ACTIVE_STATUSES),
            lte(rentalBookings.fromDate, toDate),
            gte(rentalBookings.toDate, fromDate),
          )
        )
        .groupBy(rentalBookings.rentalItemId);

      const reservedMap = new Map<string, number>(
        reservedRows.map((r) => [r.rentalItemId, r.reserved])
      );

      // Build availabilityMap and filter fully-booked items
      filteredRows = filteredRows.filter((item) => {
        const reserved = reservedMap.get(item.id) ?? 0;
        const avail    = item.stockQty - reserved;
        availabilityMap.set(item.id, avail);
        return avail > 0;
      });
    }
  }

  // FIX A3: total reflects post-filter count
  const total = (fromDate && toDate) ? filteredRows.length : rawTotal;

  return {
    items: filteredRows.map((row) => toRentalItem(row, availabilityMap.get(row.id))),
    meta:  { page, limit, total },
  };
}

// ── 2) getRentalItem ──────────────────────────────────────────────────────────

export async function getRentalItem(itemId: string): Promise<RentalItem> {
  const rows = await db
    .select()
    .from(rentalItems)
    .where(eq(rentalItems.id, itemId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('NOT_FOUND', 'Rental item not found', 404);
  }
  const row = rows[0] as RentalItemRow;
  // No date range on detail page — availableQty = stockQty
  return toRentalItem(row, row.stockQty);
}

// ── 3) createRentalItem ───────────────────────────────────────────────────────

export async function createRentalItem(
  userId: string,
  input: CreateRentalItemInput,
): Promise<RentalItem> {
  // Resolve userId → vendor row (vendors.userId is TEXT = user.id)
  const vendorRows = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (vendorRows.length === 0) {
    throw makeError('FORBIDDEN', 'Only vendors can create rental items', 403);
  }

  const vendorId = vendorRows[0]!.id;

  const inserted = await db
    .insert(rentalItems)
    .values({
      vendorId,
      name:        input.name,
      description: input.description ?? null,
      category:    input.category,
      pricePerDay: String(input.pricePerDay),
      deposit:     String(input.deposit),
      stockQty:    input.stockQty,
      r2ImageKeys: [],
      isActive:    true,
    })
    .returning();

  const row = inserted[0] as RentalItemRow;
  return toRentalItem(row, row.stockQty);
}

// ── 4) createRentalBooking ────────────────────────────────────────────────────
// FIX A1: Transactional booking to prevent overbooking

export async function createRentalBooking(
  userId: string,
  input: CreateRentalBookingInput,
): Promise<RentalBookingSummary> {
  // Fetch item (outside transaction — read-only pre-check)
  const itemRows = await db
    .select()
    .from(rentalItems)
    .where(eq(rentalItems.id, input.rentalItemId))
    .limit(1);

  if (itemRows.length === 0) {
    throw makeError('NOT_FOUND', 'Rental item not found', 404);
  }

  const item = itemRows[0] as RentalItemRow;

  if (!item.isActive) {
    throw makeError('INVALID_STATE', 'Rental item is not available for booking', 409);
  }

  // Date validation
  const from = new Date(input.fromDate);
  const to   = new Date(input.toDate);
  if (from >= to) {
    throw makeError('VALIDATION', 'fromDate must be before toDate', 400);
  }

  // Calculate totals
  const days        = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  const pricePerDay = parseFloat(item.pricePerDay);
  const deposit     = parseFloat(item.deposit);
  const totalAmount = days * pricePerDay * input.quantity;
  const depositPaid = deposit * input.quantity;

  const bookingData = {
    rentalItemId: input.rentalItemId,
    customerId:   userId,
    fromDate:     input.fromDate,
    toDate:       input.toDate,
    quantity:     input.quantity,
    totalAmount:  String(totalAmount),
    depositPaid:  String(depositPaid),
    status:       'PENDING' as const,
    notes:        input.notes ?? null,
  };

  // FIX A1: Wrap overlap-check + insert in a single transaction
  const ACTIVE_STATUSES: Array<'PENDING' | 'CONFIRMED' | 'ACTIVE'> = ['PENDING', 'CONFIRMED', 'ACTIVE'];

  const booking = await db.transaction(async (tx) => {
    const reservedRows = await tx
      .select({
        reserved: sql<number>`coalesce(sum(${rentalBookings.quantity}), 0)::int`,
      })
      .from(rentalBookings)
      .where(
        and(
          eq(rentalBookings.rentalItemId, input.rentalItemId),
          inArray(rentalBookings.status, ACTIVE_STATUSES),
          lte(rentalBookings.fromDate, input.toDate),
          gte(rentalBookings.toDate, input.fromDate),
        )
      );

    const reserved = reservedRows[0]?.reserved ?? 0;
    if (reserved + input.quantity > item.stockQty) {
      throw new Error('ITEM_NO_LONGER_AVAILABLE');
    }

    const [inserted] = await tx
      .insert(rentalBookings)
      .values(bookingData)
      .returning();

    return inserted;
  });

  const row = booking as RentalBookingRow;
  return toBookingSummary({ ...row, itemName: item.name });
}

// ── 5) confirmRentalBooking ───────────────────────────────────────────────────

export async function confirmRentalBooking(
  userId: string,
  rentalBookingId: string,
): Promise<RentalBookingSummary> {
  // Fetch booking + item + vendor in one join
  const rows = await db
    .select({
      booking:  rentalBookings,
      item:     rentalItems,
      vendorUserId: vendors.userId,
    })
    .from(rentalBookings)
    .innerJoin(rentalItems, eq(rentalBookings.rentalItemId, rentalItems.id))
    .innerJoin(vendors,     eq(rentalItems.vendorId, vendors.id))
    .where(eq(rentalBookings.id, rentalBookingId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('NOT_FOUND', 'Rental booking not found', 404);
  }

  const { booking, item, vendorUserId } = rows[0]!;

  if (vendorUserId !== userId) {
    throw makeError('FORBIDDEN', 'Only the item vendor can confirm this booking', 403);
  }

  if (booking.status !== 'PENDING') {
    throw makeError('INVALID_STATE', `Booking cannot be confirmed — current status: ${booking.status}`, 409);
  }

  const updated = await db
    .update(rentalBookings)
    .set({ status: 'CONFIRMED', updatedAt: new Date() })
    .where(and(eq(rentalBookings.id, rentalBookingId), eq(rentalBookings.status, 'PENDING')))
    .returning();

  // FIX A6: crash guard when update affects 0 rows
  if (updated.length === 0) {
    throw new Error('RENTAL_BOOKING_NOT_FOUND_OR_WRONG_VENDOR');
  }

  const row = updated[0] as RentalBookingRow;
  return toBookingSummary({ ...row, itemName: (item as RentalItemRow).name });
}

// ── 5b) activateRentalBooking (FIX A2) ───────────────────────────────────────

export async function activateRentalBooking(
  userId: string,
  rentalBookingId: string,
): Promise<RentalBookingSummary> {
  const rows = await db
    .select({
      booking:      rentalBookings,
      item:         rentalItems,
      vendorUserId: vendors.userId,
    })
    .from(rentalBookings)
    .innerJoin(rentalItems, eq(rentalBookings.rentalItemId, rentalItems.id))
    .innerJoin(vendors,     eq(rentalItems.vendorId, vendors.id))
    .where(eq(rentalBookings.id, rentalBookingId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('NOT_FOUND', 'Rental booking not found', 404);
  }

  const { booking, item, vendorUserId } = rows[0]!;

  if (vendorUserId !== userId) {
    throw makeError('FORBIDDEN', 'Only the item vendor can activate this booking', 403);
  }

  if (booking.status !== 'CONFIRMED') {
    throw makeError('INVALID_STATE', `Booking cannot be activated — current status: ${booking.status}`, 409);
  }

  const updated = await db
    .update(rentalBookings)
    .set({ status: 'ACTIVE', updatedAt: new Date() })
    .where(and(eq(rentalBookings.id, rentalBookingId), eq(rentalBookings.status, 'CONFIRMED')))
    .returning();

  if (updated.length === 0) {
    throw new Error('RENTAL_BOOKING_NOT_FOUND_OR_WRONG_VENDOR');
  }

  const row = updated[0] as RentalBookingRow;
  return toBookingSummary({ ...row, itemName: (item as RentalItemRow).name });
}

// ── 6) returnRentalItem ───────────────────────────────────────────────────────

export async function returnRentalItem(
  userId: string,
  rentalBookingId: string,
): Promise<RentalBookingSummary> {
  const rows = await db
    .select({
      booking:     rentalBookings,
      item:        rentalItems,
      vendorUserId: vendors.userId,
    })
    .from(rentalBookings)
    .innerJoin(rentalItems, eq(rentalBookings.rentalItemId, rentalItems.id))
    .innerJoin(vendors,     eq(rentalItems.vendorId, vendors.id))
    .where(eq(rentalBookings.id, rentalBookingId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('NOT_FOUND', 'Rental booking not found', 404);
  }

  const { booking, item, vendorUserId } = rows[0]!;

  if (vendorUserId !== userId) {
    throw makeError('FORBIDDEN', 'Only the item vendor can mark this booking as returned', 403);
  }

  if (booking.status !== 'ACTIVE') {
    throw makeError('INVALID_STATE', `Booking cannot be returned — current status: ${booking.status}`, 409);
  }

  const updated = await db
    .update(rentalBookings)
    .set({ status: 'RETURNED', updatedAt: new Date() })
    .where(and(eq(rentalBookings.id, rentalBookingId), eq(rentalBookings.status, 'ACTIVE')))
    .returning();

  const row = updated[0] as RentalBookingRow;
  return toBookingSummary({ ...row, itemName: (item as RentalItemRow).name });
}

// ── 7) getMyRentalBookings ────────────────────────────────────────────────────

export async function getMyRentalBookings(userId: string): Promise<RentalBookingSummary[]> {
  const rows = await db
    .select({
      booking:  rentalBookings,
      itemName: rentalItems.name,
    })
    .from(rentalBookings)
    .innerJoin(rentalItems, eq(rentalBookings.rentalItemId, rentalItems.id))
    .where(eq(rentalBookings.customerId, userId))
    .orderBy(sql`${rentalBookings.fromDate} desc`);

  return rows.map((r) =>
    toBookingSummary({ ...(r.booking as RentalBookingRow), itemName: r.itemName })
  );
}

/**
 * All rental bookings owned by the vendor account (by userId). Includes the
 * item name so the UI can render without a second fetch per row.
 */
export async function getVendorRentalBookings(vendorUserId: string): Promise<RentalBookingSummary[]> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, vendorUserId))
    .limit(1);
  if (!vendor) return [];

  const rows = await db
    .select({
      booking:  rentalBookings,
      itemName: rentalItems.name,
    })
    .from(rentalBookings)
    .innerJoin(rentalItems, eq(rentalBookings.rentalItemId, rentalItems.id))
    .where(eq(rentalItems.vendorId, vendor.id))
    .orderBy(sql`${rentalBookings.fromDate} desc`);

  return rows.map((r) =>
    toBookingSummary({ ...(r.booking as RentalBookingRow), itemName: r.itemName })
  );
}
