/**
 * Smart Shaadi — Payment Statement Service.
 *
 * Generates a per-user statement of all financial movements:
 *   payments captured, refunds, wallet credits/debits, payout receipts.
 *
 * Used for tax filing and personal record-keeping.
 */
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import type { PaymentStatement, PaymentStatementRow } from '@smartshaadi/types';

export async function getStatement(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<PaymentStatement> {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to   = new Date(`${toDate}T23:59:59Z`);

  // 1. Payments captured (customer side)
  const payments = await db
    .select({
      id:       schema.payments.id,
      bookingId: schema.payments.bookingId,
      amount:   schema.payments.amount,
      status:   schema.payments.status,
      createdAt: schema.payments.createdAt,
    })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.bookings.customerId, userId),
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
      ),
    );

  // 2. Refunds for this user
  const refunds = await db
    .select({
      id:        schema.refunds.id,
      paymentId: schema.refunds.paymentId,
      amount:    schema.refunds.amount,
      status:    schema.refunds.status,
      processedAt: schema.refunds.processedAt,
      requestedAt: schema.refunds.requestedAt,
    })
    .from(schema.refunds)
    .innerJoin(schema.payments, eq(schema.refunds.paymentId, schema.payments.id))
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.bookings.customerId, userId),
        gte(schema.refunds.requestedAt, from),
        lte(schema.refunds.requestedAt, to),
        eq(schema.refunds.status, 'COMPLETED'),
      ),
    );

  // 3. Wallet movements
  const wallet = await db
    .select()
    .from(schema.walletTransactions)
    .where(
      and(
        eq(schema.walletTransactions.userId, userId),
        gte(schema.walletTransactions.createdAt, from),
        lte(schema.walletTransactions.createdAt, to),
      ),
    );

  const rows: PaymentStatementRow[] = [];

  for (const p of payments) {
    if (p.status === 'CAPTURED' || p.status === 'PARTIALLY_REFUNDED' || p.status === 'REFUNDED') {
      rows.push({
        date:        p.createdAt.toISOString().slice(0, 10),
        type:        'PAYMENT',
        description: `Booking payment ${p.bookingId.slice(0, 8)}`,
        amount:      -Number(p.amount),
        balance:     0,
        reference:   p.id,
      });
    }
  }

  for (const r of refunds) {
    rows.push({
      date:        (r.processedAt ?? r.requestedAt).toISOString().slice(0, 10),
      type:        'REFUND',
      description: `Refund for payment ${r.paymentId.slice(0, 8)}`,
      amount:      Number(r.amount),
      balance:     0,
      reference:   r.id,
    });
  }

  for (const w of wallet) {
    rows.push({
      date:        w.createdAt.toISOString().slice(0, 10),
      type:        w.type === 'CREDIT' ? 'WALLET_CREDIT' : 'WALLET_DEBIT',
      description: w.description ?? `${w.reason} ${w.type}`,
      amount:      w.type === 'CREDIT' ? Number(w.amount) : -Number(w.amount),
      balance:     Number(w.balanceAfter),
      reference:   w.id,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));

  let running = 0;
  for (const row of rows) {
    running += row.amount;
    if (row.type !== 'WALLET_CREDIT' && row.type !== 'WALLET_DEBIT') {
      row.balance = running;
    }
  }

  const totalIn  = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = -rows.filter(r => r.amount < 0).reduce((s, r) => s + r.amount, 0);

  return {
    userId,
    fromDate,
    toDate,
    rows,
    totalIn:        Math.round(totalIn * 100) / 100,
    totalOut:       Math.round(totalOut * 100) / 100,
    closingBalance: running,
  };
}
