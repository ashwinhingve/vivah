/**
 * CSV exporters for admin reporting. All filtered by ISO date range.
 */

import { stringify } from 'csv-stringify/sync';
import { gte, lte, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';

interface DateRange { from: Date; to: Date }

export async function exportPaymentsCsv(range: DateRange): Promise<string> {
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(gte(schema.payments.createdAt, range.from), lte(schema.payments.createdAt, range.to)));
  return stringify(rows.map(r => ({
    id:                 r.id,
    bookingId:          r.bookingId,
    amount:             r.amount,
    currency:           r.currency,
    method:             r.method ?? '',
    status:             r.status,
    razorpayOrderId:    r.razorpayOrderId   ?? '',
    razorpayPaymentId:  r.razorpayPaymentId ?? '',
    createdAt:          r.createdAt.toISOString(),
    settledAt:          r.settledAt ? r.settledAt.toISOString() : '',
  })), { header: true });
}

export async function exportRefundsCsv(range: DateRange): Promise<string> {
  const rows = await db
    .select()
    .from(schema.refunds)
    .where(and(gte(schema.refunds.requestedAt, range.from), lte(schema.refunds.requestedAt, range.to)));
  return stringify(rows.map(r => ({
    id:                 r.id,
    paymentId:          r.paymentId,
    amount:             r.amount,
    status:             r.status,
    reason:             r.reason,
    razorpayRefundId:   r.razorpayRefundId ?? '',
    refundToWallet:     r.refundToWallet,
    requestedAt:        r.requestedAt.toISOString(),
    processedAt:        r.processedAt ? r.processedAt.toISOString() : '',
  })), { header: true });
}

export async function exportPayoutsCsv(range: DateRange): Promise<string> {
  const rows = await db
    .select()
    .from(schema.payouts)
    .where(and(gte(schema.payouts.createdAt, range.from), lte(schema.payouts.createdAt, range.to)));
  return stringify(rows.map(r => ({
    id:                 r.id,
    vendorId:           r.vendorId,
    bookingId:          r.bookingId ?? '',
    grossAmount:        r.grossAmount,
    platformFee:        r.platformFee,
    netAmount:          r.netAmount,
    status:             r.status,
    razorpayTransferId: r.razorpayTransferId ?? '',
    failureReason:      r.failureReason ?? '',
    createdAt:          r.createdAt.toISOString(),
    processedAt:        r.processedAt ? r.processedAt.toISOString() : '',
  })), { header: true });
}

export async function exportRevenueCsv(range: DateRange): Promise<string> {
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(gte(schema.payments.createdAt, range.from), lte(schema.payments.createdAt, range.to)));
  // Daily roll-up
  const byDay = new Map<string, { count: number; amount: number; captured: number }>();
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    const v = byDay.get(k) ?? { count: 0, amount: 0, captured: 0 };
    v.count++;
    v.amount += Number(r.amount);
    if (r.status === 'CAPTURED') v.captured++;
    byDay.set(k, v);
  }
  const out = [...byDay.entries()].sort().map(([date, v]) => ({
    date,
    payments:    v.count,
    capturedCount: v.captured,
    grossAmount: v.amount.toFixed(2),
  }));
  return stringify(out, { header: true });
}
