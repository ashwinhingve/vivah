/**
 * Vendor blocked dates — vendor self-service holiday blocking.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendorBlockedDates, vendors } from '@smartshaadi/db';
import type { VendorBlockedDate } from '@smartshaadi/types';
import type { BlockedDateInput } from '@smartshaadi/schemas';

export class BlockedDateError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BlockedDateError';
  }
}

async function resolveOwnedVendor(userId: string): Promise<{ id: string }> {
  const [v] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);
  if (!v) throw new BlockedDateError('FORBIDDEN', 'No vendor account for this user.');
  return v;
}

function toJSON(row: typeof vendorBlockedDates.$inferSelect): VendorBlockedDate {
  return {
    id:        row.id,
    vendorId:  row.vendorId,
    date:      row.date,
    reason:    row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBlockedDates(
  vendorUserId: string,
  fromMonth?: string,
): Promise<VendorBlockedDate[]> {
  const vendor = await resolveOwnedVendor(vendorUserId);

  const conds = [eq(vendorBlockedDates.vendorId, vendor.id)];
  if (fromMonth && /^\d{4}-\d{2}$/.test(fromMonth)) {
    const [year, mon] = fromMonth.split('-') as [string, string];
    const start = `${year}-${mon}-01`;
    conds.push(sql`${vendorBlockedDates.date} >= ${start}::date`);
  }

  const rows = await db
    .select()
    .from(vendorBlockedDates)
    .where(conds.length > 1 ? and(...conds) : conds[0]!)
    .orderBy(vendorBlockedDates.date);

  return rows.map(toJSON);
}

export async function addBlockedDate(
  vendorUserId: string,
  input: BlockedDateInput,
): Promise<VendorBlockedDate> {
  const vendor = await resolveOwnedVendor(vendorUserId);

  try {
    const [inserted] = await db
      .insert(vendorBlockedDates)
      .values({
        vendorId: vendor.id,
        date:     input.date,
        reason:   input.reason ?? null,
      })
      .returning();
    if (!inserted) throw new BlockedDateError('INSERT_FAILED', 'Insert failed');
    return toJSON(inserted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/duplicate key|unique/i.test(msg)) {
      throw new BlockedDateError('CONFLICT', 'Date is already blocked.');
    }
    throw e;
  }
}

export async function removeBlockedDate(
  vendorUserId: string,
  blockedId: string,
): Promise<void> {
  const vendor = await resolveOwnedVendor(vendorUserId);

  await db
    .delete(vendorBlockedDates)
    .where(and(
      eq(vendorBlockedDates.id, blockedId),
      eq(vendorBlockedDates.vendorId, vendor.id),
    ));
}
