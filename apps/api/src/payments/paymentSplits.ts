import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor } from '../lib/razorpay.js';
import { rupeesToPaise } from '../lib/money.js';

export interface AddSplitInput {
  bookingId:   string;
  paymentId?:  string;
  vendorId:    string;
  amount:      number;
  platformFee: number;
}

export interface SplitRow {
  id:          string;
  bookingId:   string;
  paymentId:   string | null;
  vendorId:    string;
  amount:      string;
  platformFee: string;
  status:      string;
  createdAt:   Date;
}

export async function addSplit(input: AddSplitInput): Promise<SplitRow> {
  const [row] = await db
    .insert(schema.paymentSplits)
    .values({
      bookingId:   input.bookingId,
      paymentId:   input.paymentId ?? null,
      vendorId:    input.vendorId,
      amount:      String(input.amount),
      platformFee: String(input.platformFee),
      status:      'PENDING',
    })
    .returning();

  if (!row) {
    throw new Error('Failed to insert payment split');
  }

  return {
    id:          row.id,
    bookingId:   row.bookingId,
    paymentId:   row.paymentId ?? null,
    vendorId:    row.vendorId,
    amount:      row.amount,
    platformFee: row.platformFee,
    status:      row.status,
    createdAt:   row.createdAt,
  };
}

export async function listSplits(bookingId: string): Promise<SplitRow[]> {
  const rows = await db
    .select()
    .from(schema.paymentSplits)
    .where(eq(schema.paymentSplits.bookingId, bookingId));

  return rows.map((row) => ({
    id:          row.id,
    bookingId:   row.bookingId,
    paymentId:   row.paymentId ?? null,
    vendorId:    row.vendorId,
    amount:      row.amount,
    platformFee: row.platformFee,
    status:      row.status,
    createdAt:   row.createdAt,
  }));
}

export async function releaseSplit(splitId: string): Promise<SplitRow> {
  const [split] = await db
    .select()
    .from(schema.paymentSplits)
    .where(eq(schema.paymentSplits.id, splitId))
    .limit(1);

  if (!split) {
    throw new Error('Split not found');
  }
  if (split.status === 'DISPUTED') {
    throw new Error('Cannot release a disputed split');
  }
  if (split.status === 'RELEASED') {
    throw new Error('Split already released');
  }

  const amount = parseFloat(split.amount);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.paymentSplits)
      .set({ status: 'RELEASED' })
      .where(
        and(
          eq(schema.paymentSplits.id, splitId),
          eq(schema.paymentSplits.status, 'PENDING'),
        ),
      );

    // Update the escrow account for this booking to reflect the partial release
    await tx
      .update(schema.escrowAccounts)
      .set({ released: split.amount, releasedAt: new Date(), status: 'RELEASED' })
      .where(eq(schema.escrowAccounts.bookingId, split.bookingId));
  });

  try {
    if (!env.USE_MOCK_SERVICES) {
      await transferToVendor(split.vendorId, rupeesToPaise(amount));
    } else {
      console.info(`[splits:mock] transferToVendor ${split.vendorId} ₹${amount}`);
    }
  } catch (e) {
    console.error(`[splits] transferToVendor failed for split ${splitId}:`, e);
    await db
      .update(schema.paymentSplits)
      .set({ status: 'RELEASE_PENDING' })
      .where(eq(schema.paymentSplits.id, splitId));
  }

  const [updated] = await db
    .select()
    .from(schema.paymentSplits)
    .where(eq(schema.paymentSplits.id, splitId))
    .limit(1);

  return {
    id:          updated!.id,
    bookingId:   updated!.bookingId,
    paymentId:   updated!.paymentId ?? null,
    vendorId:    updated!.vendorId,
    amount:      updated!.amount,
    platformFee: updated!.platformFee,
    status:      updated!.status,
    createdAt:   updated!.createdAt,
  };
}

export async function disputeSplit(splitId: string): Promise<SplitRow> {
  const [split] = await db
    .select()
    .from(schema.paymentSplits)
    .where(eq(schema.paymentSplits.id, splitId))
    .limit(1);

  if (!split) {
    throw new Error('Split not found');
  }
  if (split.status === 'RELEASED') {
    throw new Error('Cannot dispute an already-released split');
  }

  const [updated] = await db
    .update(schema.paymentSplits)
    .set({ status: 'DISPUTED' })
    .where(eq(schema.paymentSplits.id, splitId))
    .returning();

  if (!updated) {
    throw new Error('Failed to update split status');
  }

  return {
    id:          updated.id,
    bookingId:   updated.bookingId,
    paymentId:   updated.paymentId ?? null,
    vendorId:    updated.vendorId,
    amount:      updated.amount,
    platformFee: updated.platformFee,
    status:      updated.status,
    createdAt:   updated.createdAt,
  };
}
