/**
 * Multi-City Vendor Network (Unit 6.5, Sprint J) — service layer.
 *
 * Orchestrates city registry operations and density analytics. All money is
 * decimal strings (rupees), counts are integers.
 */

import { and, eq, sql, isNull, gte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  cities,
  vendors,
  bookings,
  payments,
} from '@smartshaadi/db';
import type {
  City,
  CityDensityReport,
  CityCategoryDensity,
  CityNetworkOverview,
} from '@smartshaadi/types';
import type { UpdateCitySchema, CreateCitySchema } from '@smartshaadi/schemas';
import { z } from 'zod';

// Error types for typed error handling.
export class CityNotFoundError extends Error {
  constructor(id: string) {
    super(`City ${id} not found`);
    this.name = 'CityNotFoundError';
  }
}

export class CitySlugConflictError extends Error {
  constructor(slug: string) {
    super(`City slug '${slug}' already in use`);
    this.name = 'CitySlugConflictError';
  }
}

/**
 * List all cities ordered by displayOrder, ascending.
 */
export async function listCities(): Promise<City[]> {
  const rows = await db
    .select()
    .from(cities)
    .orderBy(cities.displayOrder, cities.name);

  return rows.map((r) => ({
    ...r,
    latitude: r.latitude?.toString() ?? null,
    longitude: r.longitude?.toString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Update a city by ID with partial fields.
 * Throws CityNotFoundError if city does not exist.
 */
export async function updateCity(
  id: string,
  input: z.infer<typeof UpdateCitySchema>,
): Promise<City> {
  const result = await db
    .update(cities)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(cities.id, id))
    .returning();

  if (result.length === 0) {
    throw new CityNotFoundError(id);
  }

  const r = result[0]!;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    state: r.state,
    status: r.status,
    targetVendorsPerCategory: r.targetVendorsPerCategory,
    latitude: r.latitude?.toString() ?? null,
    longitude: r.longitude?.toString() ?? null,
    displayOrder: r.displayOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Create a new city. Throws CitySlugConflictError if slug already exists.
 */
export async function createCity(
  input: z.infer<typeof CreateCitySchema>,
): Promise<City> {
  // Check for slug conflict.
  const existing = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.slug, input.slug));

  if (existing.length > 0) {
    throw new CitySlugConflictError(input.slug);
  }

  const result = await db
    .insert(cities)
    .values({
      name: input.name,
      slug: input.slug,
      state: input.state,
      status: input.status ?? 'PLANNED',
      targetVendorsPerCategory: input.targetVendorsPerCategory ?? 3,
      latitude: input.latitude ? String(input.latitude) : null,
      longitude: input.longitude ? String(input.longitude) : null,
      displayOrder: input.displayOrder ?? 999,
    })
    .returning();

  const r = result[0]!;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    state: r.state,
    status: r.status,
    targetVendorsPerCategory: r.targetVendorsPerCategory,
    latitude: r.latitude?.toString() ?? null,
    longitude: r.longitude?.toString() ?? null,
    displayOrder: r.displayOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Compute density report for a single city. Includes category breakdowns,
 * coverage %, and bookings/revenue for the last 90 days.
 */
export async function getCityDensity(cityId: string): Promise<CityDensityReport> {
  // Fetch the city.
  const cityRows = await db
    .select()
    .from(cities)
    .where(eq(cities.id, cityId));

  if (cityRows.length === 0) {
    throw new CityNotFoundError(cityId);
  }

  const city = cityRows[0]!;
  const cityRecord: City = {
    id: city.id,
    name: city.name,
    slug: city.slug,
    state: city.state,
    status: city.status,
    targetVendorsPerCategory: city.targetVendorsPerCategory,
    latitude: city.latitude?.toString() ?? null,
    longitude: city.longitude?.toString() ?? null,
    displayOrder: city.displayOrder,
    createdAt: city.createdAt.toISOString(),
    updatedAt: city.updatedAt.toISOString(),
  };

  // Get vendor counts by category (APPROVED + active only).
  const densityRows = await db
    .select({
      category: vendors.category,
      approved: sql<number>`count(case when ${eq(vendors.status, 'APPROVED')} then 1 end)::int`,
      total: sql<number>`count(case when ${eq(vendors.isActive, true)} then 1 end)::int`,
    })
    .from(vendors)
    .where(and(eq(vendors.cityId, cityId), eq(vendors.isActive, true)))
    .groupBy(vendors.category);

  const categories: CityCategoryDensity[] = densityRows.map((row) => ({
    category: row.category,
    approved: row.approved,
    total: row.total,
    target: city.targetVendorsPerCategory,
    gap: Math.max(0, city.targetVendorsPerCategory - row.approved),
  }));

  // Total approved and active vendors across all categories.
  const totalsRow = await db
    .select({
      approved: sql<number>`count(case when ${eq(vendors.status, 'APPROVED')} then 1 end)::int`,
      total: sql<number>`count(case when ${eq(vendors.isActive, true)} then 1 end)::int`,
    })
    .from(vendors)
    .where(and(eq(vendors.cityId, cityId), eq(vendors.isActive, true)));

  const totalVendorsApproved = totalsRow[0]?.approved ?? 0;
  const totalVendorsAll = totalsRow[0]?.total ?? 0;

  // Coverage: categories at or above target / total categories evaluated.
  const categoriesAtTarget = categories.filter((c) => c.approved >= c.target).length;
  const coveragePct = categories.length > 0 ? Math.round((categoriesAtTarget / categories.length) * 100) : 0;

  // Bookings and revenue in the last 90 days.
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const bookingsRow = await db
    .select({
      count: sql<number>`count(distinct ${bookings.id})::int`,
    })
    .from(bookings)
    .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
    .where(
      and(
        eq(vendors.cityId, cityId),
        gte(bookings.createdAt, ninetyDaysAgo),
      ),
    );

  const bookingsLast90d = bookingsRow[0]?.count ?? 0;

  const revenueRow = await db
    .select({
      total: sql<string>`sum(${payments.amount})::text`,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
    .where(
      and(
        eq(vendors.cityId, cityId),
        eq(payments.status, 'CAPTURED'),
        gte(payments.createdAt, ninetyDaysAgo),
      ),
    );

  const revenueLast90d = revenueRow[0]?.total ?? '0';

  return {
    city: cityRecord,
    totalVendorsApproved,
    totalVendorsAll,
    categories,
    coveragePct,
    bookingsLast90d,
    revenueLast90d,
  };
}

/**
 * Get the full network overview: per-city snapshots + unmapped vendor bucket.
 * Efficient: single grouped query per city rather than N+1.
 */
export async function getNetworkOverview(): Promise<CityNetworkOverview> {
  // Fetch all cities.
  const allCities = await listCities();

  // For each city, get vendor counts + bookings in last 90d.
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Grouped vendor counts (APPROVED + active) per city.
  const vendorSupply = await db
    .select({
      cityId: vendors.cityId,
      approved: sql<number>`count(case when ${eq(vendors.status, 'APPROVED')} then 1 end)::int`,
    })
    .from(vendors)
    .where(and(eq(vendors.isActive, true)))
    .groupBy(vendors.cityId);

  const vendorMap = new Map<string, number>();
  for (const row of vendorSupply) {
    if (row.cityId) {
      vendorMap.set(row.cityId, row.approved);
    }
  }

  // Grouped bookings per city.
  const bookingSupply = await db
    .select({
      cityId: vendors.cityId,
      count: sql<number>`count(distinct ${bookings.id})::int`,
    })
    .from(bookings)
    .innerJoin(vendors, eq(vendors.id, bookings.vendorId))
    .where(
      and(
        eq(vendors.isActive, true),
        gte(bookings.createdAt, ninetyDaysAgo),
      ),
    )
    .groupBy(vendors.cityId);

  const bookingMap = new Map<string, number>();
  for (const row of bookingSupply) {
    if (row.cityId) {
      bookingMap.set(row.cityId, row.count);
    }
  }

  // Map all cities to overviews.
  const cityOverviews = allCities.map((city) => {
    const vendorsApproved = vendorMap.get(city.id) ?? 0;
    // Estimate categories (use category enum count minus 'OTHER').
    const numCategories = 7; // matches EXPECTED_CATEGORIES from gap.service.ts
    const gapsCount = Math.max(0, numCategories * city.targetVendorsPerCategory - vendorsApproved);
    const coveragePct = vendorsApproved > 0 ? Math.min(100, Math.round((vendorsApproved / (numCategories * city.targetVendorsPerCategory)) * 100)) : 0;

    return {
      city,
      vendorsApproved,
      coveragePct,
      gapCount: gapsCount,
      bookingsLast90d: bookingMap.get(city.id) ?? 0,
    };
  });

  // Get unmapped vendors (city_id IS NULL but isActive).
  const unmappedRows = await db
    .select({
      city: vendors.city,
    })
    .from(vendors)
    .where(and(isNull(vendors.cityId), eq(vendors.isActive, true)))
    .groupBy(vendors.city);

  const unmappedCityNames = [...new Set(unmappedRows.map((r) => r.city))].sort();

  const unmappedCount = await db
    .select({
      count: sql<number>`count(distinct ${vendors.id})::int`,
    })
    .from(vendors)
    .where(and(isNull(vendors.cityId), eq(vendors.isActive, true)));

  return {
    cities: cityOverviews,
    unmappedVendorCount: unmappedCount[0]?.count ?? 0,
    unmappedCityNames,
  };
}
