/**
 * Smart Shaadi — Vendors Service
 *
 * listVendors    — paginated, filterable, searchable, sortable vendor listing
 * getVendor      — single vendor with MongoDB portfolio
 * createVendor   — register a user as a vendor
 * updateVendor   — vendor self-service profile update
 * addService     — attach a service to a vendor (owner-only)
 * getAvailability — booked + blocked dates for a vendor in a given month
 * incrementViewCount — non-blocking view tracker
 */

import { eq, and, ilike, sql, inArray, or, gte, lte, desc, asc, type SQL } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import {
  vendors,
  vendorServices,
  bookings,
  vendorFavorites,
  vendorBlockedDates,
} from '@smartshaadi/db';
import { VendorPortfolio } from '../infrastructure/mongo/models/VendorPortfolio.js';
import type {
  VendorProfile,
  VendorService,
} from '@smartshaadi/types';
import type {
  VendorListQuery,
  CreateVendorInput,
  CreateServiceInput,
  VendorUpdateInput,
} from '@smartshaadi/schemas';

// ── Internal types ─────────────────────────────────────────────────────────────

export interface PortfolioDoc {
  about?: string;
  tagline?: string;
  portfolio?: unknown[];
  packages?: Array<{
    name?: string;
    price?: number;
    priceUnit?: string;
    inclusions?: string[];
    exclusions?: string[];
    photoKeys?: string[];
  }>;
  faqs?: unknown[];
  awards?: string[];
}

type VendorRow = typeof vendors.$inferSelect;
type ServiceRow = typeof vendorServices.$inferSelect;

function num(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function mapVendorRow(
  vendor: VendorRow,
  serviceRows: ServiceRow[],
  portfolioKey: string | null = null,
  isFavorite = false,
): VendorProfile {
  const mappedServices: VendorService[] = serviceRows.map((s) => ({
    id:          s.id,
    name:        s.name,
    priceFrom:   s.priceFrom != null ? parseFloat(s.priceFrom) : 0,
    priceTo:     s.priceTo != null ? parseFloat(s.priceTo) : null,
    unit:        s.priceUnit ?? 'PER_EVENT',
    description: s.description,
  }));

  return {
    id:               vendor.id,
    businessName:     vendor.businessName,
    category:         vendor.category as VendorProfile['category'],
    city:             vendor.city,
    state:            vendor.state,
    rating:           vendor.rating != null ? parseFloat(vendor.rating) : 0,
    totalReviews:     vendor.totalReviews,
    verified:         vendor.verified,
    services:         mappedServices,
    portfolioKey,
    tagline:          vendor.tagline ?? null,
    description:      vendor.description ?? null,
    coverImageKey:    vendor.coverImageKey ?? null,
    phone:            vendor.phone ?? null,
    email:            vendor.email ?? null,
    website:          vendor.website ?? null,
    instagram:        vendor.instagram ?? null,
    yearsActive:      vendor.yearsActive ?? null,
    responseTimeHours: vendor.responseTimeHours ?? null,
    priceMin:         num(vendor.priceMin),
    priceMax:         num(vendor.priceMax),
    viewCount:        vendor.viewCount,
    favoriteCount:    vendor.favoriteCount,
    isFavorite,
  };
}

// ── listVendors ────────────────────────────────────────────────────────────────

export async function listVendors(
  query: VendorListQuery,
  viewerId?: string,
): Promise<{ vendors: VendorProfile[]; meta: { page: number; total: number; limit: number } }> {
  const {
    category, city, state, q, priceMin, priceMax,
    minRating, verifiedOnly, sort, page, limit,
  } = query;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [eq(vendors.isActive, true)];
  if (category)     conditions.push(eq(vendors.category, category as VendorRow['category']));
  if (city)         conditions.push(ilike(vendors.city, `%${city}%`));
  if (state)        conditions.push(ilike(vendors.state, `%${state}%`));
  if (verifiedOnly) conditions.push(eq(vendors.verified, true));
  if (minRating != null) {
    conditions.push(sql`${vendors.rating} >= ${minRating}`);
  }
  if (q) {
    const pattern = `%${q}%`;
    const orCond = or(
      ilike(vendors.businessName, pattern),
      ilike(vendors.tagline, pattern),
      ilike(vendors.description, pattern),
      ilike(vendors.city, pattern),
    );
    if (orCond) conditions.push(orCond);
  }
  // priceMin/Max: treat as overlap with vendor's [priceMin, priceMax] range when set
  if (priceMin != null) {
    conditions.push(or(
      sql`${vendors.priceMax} IS NULL`,
      gte(vendors.priceMax, String(priceMin)),
    )!);
  }
  if (priceMax != null) {
    conditions.push(or(
      sql`${vendors.priceMin} IS NULL`,
      lte(vendors.priceMin, String(priceMax)),
    )!);
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  const orderBy = (() => {
    switch (sort) {
      case 'rating':     return [desc(vendors.rating), desc(vendors.totalReviews)];
      case 'price_low':  return [asc(sql`COALESCE(${vendors.priceMin}, ${vendors.priceMax}, 99999999)`)];
      case 'price_high': return [desc(sql`COALESCE(${vendors.priceMax}, ${vendors.priceMin}, 0)`)];
      case 'recent':     return [desc(vendors.createdAt)];
      case 'popular':
      default:           return [desc(vendors.totalReviews), desc(vendors.rating), desc(vendors.viewCount)];
    }
  })();

  const countRows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendors)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const vendorRows = await db
    .select()
    .from(vendors)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  if (vendorRows.length === 0) {
    return { vendors: [], meta: { page, total, limit } };
  }

  const vendorIds = vendorRows.map((v) => v.id);
  const allServices = await db
    .select()
    .from(vendorServices)
    .where(
      and(
        inArray(vendorServices.vendorId, vendorIds),
        eq(vendorServices.isActive, true),
      ),
    );

  const servicesByVendor = new Map<string, ServiceRow[]>();
  for (const svc of allServices) {
    const list = servicesByVendor.get(svc.vendorId) ?? [];
    list.push(svc);
    servicesByVendor.set(svc.vendorId, list);
  }

  // Favorite status for viewer
  let favoriteSet = new Set<string>();
  if (viewerId) {
    const favs = await db
      .select({ vendorId: vendorFavorites.vendorId })
      .from(vendorFavorites)
      .where(
        and(
          eq(vendorFavorites.userId, viewerId),
          inArray(vendorFavorites.vendorId, vendorIds),
        ),
      );
    favoriteSet = new Set(favs.map((f) => f.vendorId));
  }

  const result = vendorRows.map((v) =>
    mapVendorRow(
      v,
      servicesByVendor.get(v.id) ?? [],
      v.mongoPortfolioId,
      favoriteSet.has(v.id),
    ),
  );

  return { vendors: result, meta: { page, total, limit } };
}

// ── getVendor ──────────────────────────────────────────────────────────────────

export async function getVendor(
  vendorId: string,
  viewerId?: string,
): Promise<(VendorProfile & { portfolio: PortfolioDoc | null }) | null> {
  const vendorRows = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (vendorRows.length === 0) return null;

  const vendor = vendorRows[0]!;

  const serviceRows = await db
    .select()
    .from(vendorServices)
    .where(and(eq(vendorServices.vendorId, vendorId), eq(vendorServices.isActive, true)));

  let portfolio: PortfolioDoc | null = null;
  if (env.USE_MOCK_SERVICES) {
    portfolio = null;
  } else {
    try {
      const doc = await VendorPortfolio.findOne({ vendorId }).lean();
      portfolio = doc as PortfolioDoc | null;
    } catch (mongoErr) {
      console.error('[vendors/getVendor] MongoDB error:', mongoErr);
      portfolio = null;
    }
  }

  let isFavorite = false;
  if (viewerId) {
    const fav = await db
      .select({ id: vendorFavorites.id })
      .from(vendorFavorites)
      .where(and(eq(vendorFavorites.userId, viewerId), eq(vendorFavorites.vendorId, vendorId)))
      .limit(1);
    isFavorite = fav.length > 0;
  }

  const base = mapVendorRow(vendor, serviceRows, vendor.mongoPortfolioId, isFavorite);
  return { ...base, portfolio };
}

// ── incrementViewCount ─────────────────────────────────────────────────────────

export async function incrementViewCount(vendorId: string): Promise<void> {
  try {
    await db
      .update(vendors)
      .set({ viewCount: sql`${vendors.viewCount} + 1` })
      .where(eq(vendors.id, vendorId));
  } catch (e) {
    console.error('[vendors/incrementViewCount]', e);
  }
}

// ── createVendor ───────────────────────────────────────────────────────────────

export async function createVendor(
  userId: string,
  input: CreateVendorInput,
): Promise<VendorProfile> {
  const inserted = await db
    .insert(vendors)
    .values({
      userId,
      businessName: input.businessName,
      category:     input.category as VendorRow['category'],
      city:         input.city,
      state:        input.state,
    })
    .returning();

  const vendor = inserted[0]!;
  return mapVendorRow(vendor, []);
}

// ── updateVendor ───────────────────────────────────────────────────────────────

export async function updateVendor(
  userId: string,
  vendorId: string,
  input: VendorUpdateInput,
): Promise<VendorProfile> {
  const ownership = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.userId, userId)))
    .limit(1);

  if (ownership.length === 0) {
    throw new Error('access denied');
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.businessName !== undefined) patch['businessName'] = input.businessName;
  if (input.category     !== undefined) patch['category']     = input.category;
  if (input.city         !== undefined) patch['city']         = input.city;
  if (input.state        !== undefined) patch['state']        = input.state;
  if (input.tagline      !== undefined) patch['tagline']      = input.tagline;
  if (input.description  !== undefined) patch['description']  = input.description;
  if (input.coverImageKey !== undefined) patch['coverImageKey'] = input.coverImageKey;
  if (input.phone        !== undefined) patch['phone']        = input.phone;
  if (input.email        !== undefined) patch['email']        = input.email;
  if (input.website      !== undefined) patch['website']      = input.website;
  if (input.instagram    !== undefined) patch['instagram']    = input.instagram;
  if (input.yearsActive  !== undefined) patch['yearsActive']  = input.yearsActive;
  if (input.responseTimeHours !== undefined) patch['responseTimeHours'] = input.responseTimeHours;
  if (input.priceMin     !== undefined) patch['priceMin']     = input.priceMin == null ? null : String(input.priceMin);
  if (input.priceMax     !== undefined) patch['priceMax']     = input.priceMax == null ? null : String(input.priceMax);
  if (input.isActive     !== undefined) patch['isActive']     = input.isActive;

  const [updated] = await db
    .update(vendors)
    .set(patch)
    .where(eq(vendors.id, vendorId))
    .returning();

  if (!updated) throw new Error('Failed to update vendor');

  const serviceRows = await db
    .select()
    .from(vendorServices)
    .where(and(eq(vendorServices.vendorId, vendorId), eq(vendorServices.isActive, true)));

  return mapVendorRow(updated, serviceRows, updated.mongoPortfolioId);
}

// ── addService ─────────────────────────────────────────────────────────────────

export async function addService(
  vendorId: string,
  userId: string,
  input: CreateServiceInput,
): Promise<VendorService> {
  const vendorRows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.userId, userId)))
    .limit(1);

  if (vendorRows.length === 0) {
    throw new Error('Vendor not found or access denied');
  }

  const inserted = await db
    .insert(vendorServices)
    .values({
      vendorId,
      name:        input.name,
      description: input.description ?? null,
      priceFrom:   String(input.priceFrom),
      priceTo:     input.priceTo != null ? String(input.priceTo) : null,
      priceUnit:   input.unit,
    })
    .returning();

  const svc = inserted[0]!;
  return {
    id:          svc.id,
    name:        svc.name,
    priceFrom:   svc.priceFrom != null ? parseFloat(svc.priceFrom) : 0,
    priceTo:     svc.priceTo != null ? parseFloat(svc.priceTo) : null,
    unit:        svc.priceUnit ?? 'PER_EVENT',
    description: svc.description,
  };
}

// ── getAvailability ────────────────────────────────────────────────────────────

export interface AvailabilityResult {
  bookedDates:  string[];
  blockedDates: { date: string; reason: string | null }[];
}

export async function getAvailability(
  vendorId: string,
  month: string,
): Promise<AvailabilityResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must be in YYYY-MM format');
  const [year, mon] = month.split('-') as [string, string];

  const start = `${year}-${mon}-01`;
  const nextMonth = parseInt(mon, 10) === 12
    ? `${parseInt(year, 10) + 1}-01-01`
    : `${year}-${String(parseInt(mon, 10) + 1).padStart(2, '0')}-01`;

  const [bookedRows, blockedRows] = await Promise.all([
    db
      .select({ eventDate: bookings.eventDate })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          inArray(bookings.status, ['PENDING', 'CONFIRMED']),
          sql`${bookings.eventDate} >= ${start}::date AND ${bookings.eventDate} < ${nextMonth}::date`,
        ),
      ),
    db
      .select({ date: vendorBlockedDates.date, reason: vendorBlockedDates.reason })
      .from(vendorBlockedDates)
      .where(
        and(
          eq(vendorBlockedDates.vendorId, vendorId),
          sql`${vendorBlockedDates.date} >= ${start}::date AND ${vendorBlockedDates.date} < ${nextMonth}::date`,
        ),
      ),
  ]);

  return {
    bookedDates:  bookedRows.map((r) => r.eventDate as string),
    blockedDates: blockedRows.map((r) => ({ date: r.date as string, reason: r.reason })),
  };
}
