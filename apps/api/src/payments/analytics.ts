/**
 * Smart Shaadi — Payments Analytics Service.
 *
 * Powers the admin revenue dashboard. All queries SQL-aggregate; no in-memory
 * row scanning. Aggregates by day / category / status.
 */
import { eq, and, sql, gte, lte, inArray, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import type { RevenueSummary, RevenueByCategory, DailyRevenuePoint } from '@smartshaadi/types';
import { totalWalletLiability } from './wallet.js';

export class AnalyticsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

async function assertAdmin(adminId: string): Promise<void> {
  const [admin] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, adminId))
    .limit(1);
  if (!admin || admin.role !== 'ADMIN') throw new AnalyticsError('FORBIDDEN', 'Admin role required');
}

function parseRange(fromDate?: string, toDate?: string): { from: Date; to: Date } {
  const to   = toDate ? new Date(`${toDate}T23:59:59Z`) : new Date();
  const from = fromDate ? new Date(`${fromDate}T00:00:00Z`) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function getRevenueSummary(
  adminId: string,
  fromDate?: string,
  toDate?: string,
): Promise<RevenueSummary> {
  await assertAdmin(adminId);
  const { from, to } = parseRange(fromDate, toDate);

  const [paymentsAgg] = await db
    .select({
      gross:     sql<string>`COALESCE(SUM(CASE WHEN ${schema.payments.status} IN ('CAPTURED','PARTIALLY_REFUNDED') THEN ${schema.payments.amount} ELSE 0 END), 0)`,
      bookCount: sql<string>`COUNT(*) FILTER (WHERE ${schema.payments.status} IN ('CAPTURED','PARTIALLY_REFUNDED'))`,
      attempts:  sql<string>`COUNT(*)`,
    })
    .from(schema.payments)
    .where(and(gte(schema.payments.createdAt, from), lte(schema.payments.createdAt, to)));

  const [refundsAgg] = await db
    .select({
      refunded: sql<string>`COALESCE(SUM(${schema.refunds.amount}), 0)`,
    })
    .from(schema.refunds)
    .where(
      and(
        gte(schema.refunds.requestedAt, from),
        lte(schema.refunds.requestedAt, to),
        eq(schema.refunds.status, 'COMPLETED'),
      ),
    );

  const [payoutsAgg] = await db
    .select({
      pending:    sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} IN ('SCHEDULED','PROCESSING') THEN ${schema.payouts.netAmount} ELSE 0 END), 0)`,
      completed:  sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status}='COMPLETED' THEN ${schema.payouts.netAmount} ELSE 0 END), 0)`,
      fees:       sql<string>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} IN ('COMPLETED','PROCESSING') THEN ${schema.payouts.platformFee} ELSE 0 END), 0)`,
    })
    .from(schema.payouts)
    .where(and(gte(schema.payouts.createdAt, from), lte(schema.payouts.createdAt, to)));

  const [taxAgg] = await db
    .select({ tax: sql<string>`COALESCE(SUM(${schema.invoices.totalTax}), 0)` })
    .from(schema.invoices)
    .where(
      and(
        gte(schema.invoices.issuedAt, from),
        lte(schema.invoices.issuedAt, to),
        inArray(schema.invoices.status, ['ISSUED', 'PAID']),
      ),
    );

  const [orderAgg] = await db
    .select({
      orders: sql<string>`COUNT(*) FILTER (WHERE ${schema.orders.status} IN ('CONFIRMED','SHIPPED','DELIVERED'))`,
    })
    .from(schema.orders)
    .where(and(gte(schema.orders.createdAt, from), lte(schema.orders.createdAt, to)));

  const grossRevenue       = Number(paymentsAgg?.gross ?? 0);
  const refunded           = Number(refundsAgg?.refunded ?? 0);
  const pendingPayouts     = Number(payoutsAgg?.pending ?? 0);
  const completedPayouts   = Number(payoutsAgg?.completed ?? 0);
  const platformFees       = Number(payoutsAgg?.fees ?? 0);
  const taxCollected       = Number(taxAgg?.tax ?? 0);
  const bookingsCount      = Number(paymentsAgg?.bookCount ?? 0);
  const ordersCount        = Number(orderAgg?.orders ?? 0);
  const attempts           = Number(paymentsAgg?.attempts ?? 0);

  return {
    periodStart:        from.toISOString().slice(0, 10),
    periodEnd:          to.toISOString().slice(0, 10),
    grossRevenue,
    netRevenue:         grossRevenue - refunded,
    refunded,
    pendingPayouts,
    completedPayouts,
    platformFees,
    taxCollected,
    bookingsCount,
    ordersCount,
    avgBookingValue:    bookingsCount > 0 ? Math.round((grossRevenue / bookingsCount) * 100) / 100 : 0,
    paymentSuccessRate: attempts > 0 ? Math.round((bookingsCount / attempts) * 10000) / 100 : 0,
  };
}

export async function getDailyRevenue(
  adminId: string,
  fromDate?: string,
  toDate?: string,
): Promise<DailyRevenuePoint[]> {
  await assertAdmin(adminId);
  const { from, to } = parseRange(fromDate, toDate);

  const rows = await db
    .select({
      date:  sql<string>`DATE(${schema.payments.createdAt})`,
      gross: sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(schema.payments)
    .where(
      and(
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
        inArray(schema.payments.status, ['CAPTURED', 'PARTIALLY_REFUNDED']),
      ),
    )
    .groupBy(sql`DATE(${schema.payments.createdAt})`)
    .orderBy(sql`DATE(${schema.payments.createdAt})`);

  return rows.map(r => ({
    date:  r.date,
    gross: Number(r.gross),
    net:   Number(r.gross),
    count: Number(r.count),
  }));
}

export async function getRevenueByCategory(
  adminId: string,
  fromDate?: string,
  toDate?: string,
): Promise<RevenueByCategory[]> {
  await assertAdmin(adminId);
  const { from, to } = parseRange(fromDate, toDate);

  const rows = await db
    .select({
      category: schema.vendors.category,
      revenue:  sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)`,
      count:    sql<string>`COUNT(*)`,
    })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .innerJoin(schema.vendors, eq(schema.bookings.vendorId, schema.vendors.id))
    .where(
      and(
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
        inArray(schema.payments.status, ['CAPTURED', 'PARTIALLY_REFUNDED']),
      ),
    )
    .groupBy(schema.vendors.category)
    .orderBy(sql`SUM(${schema.payments.amount}) DESC`);

  const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
  return rows.map(r => ({
    category: String(r.category),
    revenue:  Number(r.revenue),
    count:    Number(r.count),
    pct:      total > 0 ? Math.round((Number(r.revenue) / total) * 10000) / 100 : 0,
  }));
}

export async function getTopVendorsByRevenue(
  adminId: string,
  limit = 10,
  fromDate?: string,
  toDate?: string,
) {
  await assertAdmin(adminId);
  const { from, to } = parseRange(fromDate, toDate);

  return db
    .select({
      vendorId:     schema.vendors.id,
      businessName: schema.vendors.businessName,
      category:     schema.vendors.category,
      revenue:      sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)`,
      bookings:     sql<string>`COUNT(*)`,
    })
    .from(schema.payments)
    .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
    .innerJoin(schema.vendors, eq(schema.bookings.vendorId, schema.vendors.id))
    .where(
      and(
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
        inArray(schema.payments.status, ['CAPTURED', 'PARTIALLY_REFUNDED']),
      ),
    )
    .groupBy(schema.vendors.id, schema.vendors.businessName, schema.vendors.category)
    .orderBy(desc(sql`SUM(${schema.payments.amount})`))
    .limit(limit);
}

export async function getOpenLiabilities(adminId: string) {
  await assertAdmin(adminId);

  const [escrowAgg] = await db
    .select({ held: sql<string>`COALESCE(SUM(${schema.escrowAccounts.totalHeld}), 0)` })
    .from(schema.escrowAccounts)
    .where(eq(schema.escrowAccounts.status, 'HELD'));

  const [pendingPayouts] = await db
    .select({ pending: sql<string>`COALESCE(SUM(${schema.payouts.netAmount}), 0)` })
    .from(schema.payouts)
    .where(inArray(schema.payouts.status, ['SCHEDULED', 'PROCESSING']));

  const walletLiability = await totalWalletLiability();

  return {
    escrowHeld:        Number(escrowAgg?.held ?? 0),
    pendingPayouts:    Number(pendingPayouts?.pending ?? 0),
    walletLiability,
  };
}
