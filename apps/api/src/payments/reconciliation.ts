import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import * as schema from '@smartshaadi/db';
import { fetchSettlements } from '../lib/razorpay.js';
import { logger } from '../lib/logger.js';

export class ReconciliationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

export async function reconcileDay(date: Date): Promise<{ inserted: number; checked: number }> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const from = Math.floor(dayStart.getTime() / 1000);
  const to   = Math.floor(dayEnd.getTime() / 1000);

  let items: Awaited<ReturnType<typeof fetchSettlements>>;
  if (env.USE_MOCK_SERVICES) {
    logger.debug({ date: date.toISOString() }, '[reconciliation:mock] fetchSettlements');
    items = [];
  } else {
    items = await fetchSettlements(from, to);
  }

  let inserted = 0;

  for (const item of items) {
    if (item.type !== 'payment') continue;

    const [localPayment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.razorpayPaymentId, item.payment_id))
      .limit(1);

    if (!localPayment) {
      await db
        .insert(schema.reconciliationDiscrepancies)
        .values({
          razorpayPaymentId: item.payment_id,
          field:             'status',
          expected:          'exists_in_db',
          actual:            'missing_from_db',
        })
        .onConflictDoNothing();
      inserted++;
      continue;
    }

    const checks: Array<{ field: string; expected: string; actual: string }> = [];

    const localAmount = Math.round(parseFloat(localPayment.amount) * 100);
    if (localAmount !== item.amount) {
      checks.push({ field: 'amount', expected: String(localAmount), actual: String(item.amount) });
    }

    const capturedStatuses = new Set(['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED']);
    const rzpCaptured = item.type === 'payment';
    const dbCaptured  = capturedStatuses.has(localPayment.status);
    if (rzpCaptured !== dbCaptured) {
      checks.push({ field: 'status', expected: localPayment.status, actual: rzpCaptured ? 'captured' : 'not_captured' });
    }

    const dbFees = Math.round(parseFloat((localPayment as { fees?: string }).fees ?? '0') * 100);
    if (dbFees !== item.fee) {
      checks.push({ field: 'fees', expected: String(dbFees), actual: String(item.fee) });
    }

    for (const check of checks) {
      const rows = await db
        .insert(schema.reconciliationDiscrepancies)
        .values({
          paymentId:         localPayment.id,
          razorpayPaymentId: item.payment_id,
          field:             check.field,
          expected:          check.expected,
          actual:            check.actual,
        })
        .onConflictDoNothing()
        .returning({ id: schema.reconciliationDiscrepancies.id });
      if (rows.length > 0) inserted++;
    }
  }

  return { inserted, checked: items.length };
}

export async function listOpenDiscrepancies() {
  return db
    .select()
    .from(schema.reconciliationDiscrepancies)
    .where(
      and(
        eq(schema.reconciliationDiscrepancies.status, 'OPEN'),
        isNull(schema.reconciliationDiscrepancies.resolvedAt),
      ),
    )
    .orderBy(schema.reconciliationDiscrepancies.detectedAt);
}

export async function listDiscrepancies(status?: string) {
  if (status) {
    return db
      .select()
      .from(schema.reconciliationDiscrepancies)
      .where(eq(schema.reconciliationDiscrepancies.status, status as typeof schema.reconciliationStatusEnum.enumValues[number]))
      .orderBy(schema.reconciliationDiscrepancies.detectedAt);
  }
  return db
    .select()
    .from(schema.reconciliationDiscrepancies)
    .orderBy(schema.reconciliationDiscrepancies.detectedAt);
}

export async function markResolved(id: string, notes: string) {
  const [updated] = await db
    .update(schema.reconciliationDiscrepancies)
    .set({ status: 'RESOLVED', notes, resolvedAt: new Date() })
    .where(eq(schema.reconciliationDiscrepancies.id, id))
    .returning();
  if (!updated) throw new ReconciliationError('NOT_FOUND', 'Discrepancy not found');
  return updated;
}
