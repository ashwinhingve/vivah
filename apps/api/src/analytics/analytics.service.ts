/**
 * Smart Shaadi — Analytics Service.
 *
 * Aggregates booking demand, revenue, and vendor utilization from the database.
 * All queries use SQL aggregations; no in-memory row scanning.
 * Returns monthly series suitable for forecasting.
 */

import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import type { ProfileId } from '@smartshaadi/types';
import { forecast } from './forecasting.js';

export class AnalyticsServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}

/**
 * Monthly demand series: booking count per month.
 * Returns { month, count } tuples sorted chronologically.
 *
 * @param fromMonthKey ISO month YYYY-MM (default: 12 months ago)
 * @param toMonthKey ISO month YYYY-MM (default: current month)
 * @returns Array of { month, count }
 */
export async function getDemandSeries(
  fromMonthKey?: string,
  toMonthKey?: string,
): Promise<Array<{ month: string; count: number }>> {
  const to = toMonthKey ? new Date(`${toMonthKey}-01T23:59:59Z`) : new Date();
  const from = fromMonthKey
    ? new Date(`${fromMonthKey}-01T00:00:00Z`)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`,
      count: sql<string>`COUNT(*)`,
    })
    .from(schema.bookings)
    .where(
      and(
        gte(schema.bookings.eventDate, from.toISOString().slice(0, 10)),
        lte(schema.bookings.eventDate, to.toISOString().slice(0, 10)),
      ),
    )
    .groupBy(sql`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`);

  return rows.map(r => ({
    month: r.month,
    count: Number(r.count),
  }));
}

/**
 * Monthly revenue series: captured payments per month (in rupees).
 * Returns { month, revenue } tuples sorted chronologically.
 *
 * @param fromMonthKey ISO month YYYY-MM (default: 12 months ago)
 * @param toMonthKey ISO month YYYY-MM (default: current month)
 * @returns Array of { month, revenue }
 */
export async function getRevenueSeries(
  fromMonthKey?: string,
  toMonthKey?: string,
): Promise<Array<{ month: string; revenue: number }>> {
  const to = toMonthKey ? new Date(`${toMonthKey}-01T23:59:59Z`) : new Date();
  const from = fromMonthKey
    ? new Date(`${fromMonthKey}-01T00:00:00Z`)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${schema.payments.createdAt}, 'YYYY-MM')`,
      revenue: sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)`,
    })
    .from(schema.payments)
    .where(
      and(
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
        inArray(schema.payments.status, ['CAPTURED', 'PARTIALLY_REFUNDED']),
      ),
    )
    .groupBy(sql`TO_CHAR(${schema.payments.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${schema.payments.createdAt}, 'YYYY-MM')`);

  return rows.map(r => ({
    month: r.month,
    revenue: Number(r.revenue), // rupees (decimal stored as string)
  }));
}

/**
 * Per-vendor monthly utilization series.
 * Returns { month, utilization } where utilization = sum(bookedCount) / sum(maxBookings).
 *
 * @param profileId Vendor's profile UUID
 * @param fromMonthKey ISO month YYYY-MM (default: 12 months ago)
 * @param toMonthKey ISO month YYYY-MM (default: current month)
 * @returns Array of { month, utilization } as decimal 0..1
 */
export async function getUtilizationSeries(
  profileId: ProfileId,
  fromMonthKey?: string,
  toMonthKey?: string,
): Promise<Array<{ month: string; utilization: number }>> {
  const to = toMonthKey ? new Date(`${toMonthKey}-01T23:59:59Z`) : new Date();
  const from = fromMonthKey
    ? new Date(`${fromMonthKey}-01T00:00:00Z`)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${schema.vendorCapacity.startAt}, 'YYYY-MM')`,
      booked: sql<string>`COALESCE(SUM(${schema.vendorCapacity.bookedCount}), 0)`,
      max: sql<string>`COALESCE(SUM(${schema.vendorCapacity.maxBookings}), 1)`,
    })
    .from(schema.vendorCapacity)
    .where(
      and(
        eq(schema.vendorCapacity.profileId, profileId),
        gte(schema.vendorCapacity.startAt, from),
        lte(schema.vendorCapacity.startAt, to),
      ),
    )
    .groupBy(sql`TO_CHAR(${schema.vendorCapacity.startAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${schema.vendorCapacity.startAt}, 'YYYY-MM')`);

  return rows.map(r => {
    const booked = Number(r.booked);
    const max = Number(r.max) || 1;
    return {
      month: r.month,
      utilization: booked / max,
    };
  });
}

/**
 * Per-vendor monthly revenue series from the vendor's OWN bookings (rupees).
 * Keyed by vendors.id (bookings.vendorId) — never platform-wide, so a vendor
 * only ever sees their own revenue (multi-tenant safety). Counts money-committed
 * bookings (CONFIRMED / COMPLETED), bucketed by event month.
 *
 * @param vendorId vendors.id UUID
 * @param fromMonthKey ISO month YYYY-MM (default: 12 months ago)
 * @param toMonthKey ISO month YYYY-MM (default: current month)
 * @returns Array of { month, revenue }
 */
export async function getVendorRevenueSeries(
  vendorId: string,
  fromMonthKey?: string,
  toMonthKey?: string,
): Promise<Array<{ month: string; revenue: number }>> {
  const to = toMonthKey ? new Date(`${toMonthKey}-01T23:59:59Z`) : new Date();
  const from = fromMonthKey
    ? new Date(`${fromMonthKey}-01T00:00:00Z`)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`,
      revenue: sql<string>`COALESCE(SUM(${schema.bookings.totalAmount}), 0)`,
    })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.vendorId, vendorId),
        gte(schema.bookings.eventDate, from.toISOString().slice(0, 10)),
        lte(schema.bookings.eventDate, to.toISOString().slice(0, 10)),
        inArray(schema.bookings.status, ['CONFIRMED', 'COMPLETED']),
      ),
    )
    .groupBy(sql`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${schema.bookings.eventDate}, 'YYYY-MM')`);

  return rows.map(r => ({
    month: r.month,
    revenue: Number(r.revenue), // rupees (decimal stored as string)
  }));
}

/**
 * Vendor forecast: historical utilization + revenue with projections.
 *
 * Returns:
 *   - utilization: { history: [{ month, utilization }], forecast: number[] }
 *   - revenue: { history: [{ month, revenue }], forecast: number[] }
 *
 * Utilization is keyed by the vendor's profileId (vendor_capacity.profileId);
 * revenue is keyed by the vendor's vendorId (bookings.vendorId) — never platform
 * revenue. Projects 6 months forward using seasonal decomposition (12-month period).
 */
export async function getVendorForecast(vendorId: string, profileId: ProfileId): Promise<{
  utilization: {
    history: Array<{ month: string; utilization: number }>;
    forecast: number[];
    level: number;
  };
  revenue: {
    history: Array<{ month: string; revenue: number }>;
    forecast: number[];
    level: number;
  };
}> {
  const [utilHistory, revenueHistory] = await Promise.all([
    getUtilizationSeries(profileId),
    getVendorRevenueSeries(vendorId),
  ]);

  const utilValues = utilHistory.map(r => r.utilization);
  const revenueValues = revenueHistory.map(r => r.revenue);

  const utilLevel = utilValues.length > 0 ? utilValues[utilValues.length - 1]! : 0;
  const revenueLevel = revenueValues.length > 0 ? revenueValues[revenueValues.length - 1]! : 0;

  const utilForecast = forecast(utilValues, 6, 12);
  const revenueForecast = forecast(revenueValues, 6, 12);

  return {
    utilization: {
      history: utilHistory,
      forecast: utilForecast,
      level: utilLevel,
    },
    revenue: {
      history: revenueHistory,
      forecast: revenueForecast,
      level: revenueLevel,
    },
  };
}

/**
 * Platform forecast: demand + revenue with projections.
 *
 * Returns:
 *   - demand: { history: [{ month, count }], forecast: number[] }
 *   - revenue: { history: [{ month, revenue }], forecast: number[] }
 *
 * Validates admin role (caller checks authorization layer).
 */
export async function getAdminForecast(): Promise<{
  demand: {
    history: Array<{ month: string; count: number }>;
    forecast: number[];
    level: number;
  };
  revenue: {
    history: Array<{ month: string; revenue: number }>;
    forecast: number[];
    level: number;
  };
}> {
  const [demandHistory, revenueHistory] = await Promise.all([
    getDemandSeries(),
    getRevenueSeries(),
  ]);

  const demandValues = demandHistory.map(r => r.count);
  const revenueValues = revenueHistory.map(r => r.revenue);

  const demandLevel = demandValues.length > 0 ? demandValues[demandValues.length - 1]! : 0;
  const revenueLevel = revenueValues.length > 0 ? revenueValues[revenueValues.length - 1]! : 0;

  const demandForecast = forecast(demandValues, 6, 12);
  const revenueForecast = forecast(revenueValues, 6, 12);

  return {
    demand: {
      history: demandHistory,
      forecast: demandForecast,
      level: demandLevel,
    },
    revenue: {
      history: revenueHistory,
      forecast: revenueForecast,
      level: revenueLevel,
    },
  };
}
