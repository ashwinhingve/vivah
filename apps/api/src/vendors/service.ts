/**
 * Smart Shaadi — Vendors Service
 *
 * listVendors    — paginated, filterable vendor listing
 * getVendor      — single vendor with MongoDB portfolio
 * createVendor   — register a user as a vendor
 * addService     — attach a service to a vendor (owner-only)
 * getAvailability — booked dates for a vendor in a given month
 */

import { eq, and, ilike, sql, inArray, type SQL } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { env } from '../lib/env.js';
import { vendors, vendorServices, bookings } from '@smartshaadi/db';
import { VendorPortfolio } from '../infrastructure/mongo/models/VendorPortfolio.js';
import type {
  VendorProfile,
  VendorService,
} from '@smartshaadi/types';
import type {
  VendorListQuery,
  CreateVendorInput,
  CreateServiceInput,
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

function mapVendorRow(
  vendor: VendorRow,
  serviceRows: ServiceRow[],
  portfolioKey: string | null = null,
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
    id:           vendor.id,
    businessName: vendor.businessName,
    category:     vendor.category as VendorProfile['category'],
    city:         vendor.city,
    state:        vendor.state,
    rating:       vendor.rating != null ? parseFloat(vendor.rating) : 0,
    totalReviews: vendor.totalReviews,
    verified:     vendor.verified,
    services:     mappedServices,
    portfolioKey,
  };
}

// ── listVendors ────────────────────────────────────────────────────────────────

export async function listVendors(
  query: VendorListQuery,
): Promise<{ vendors: VendorProfile[]; meta: { page: number; total: number; limit: number } }> {
  const { category, city, state, page, limit } = query;
  const offset = (page - 1) * limit;

  // Build filter conditions
  const conditions: SQL[] = [eq(vendors.isActive, true)];
  if (category) conditions.push(eq(vendors.category, category as VendorRow['category']));
  if (city)     conditions.push(ilike(vendors.city, `%${city}%`));
  if (state)    conditions.push(ilike(vendors.state, `%${state}%`));

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  // Count total
  const countRows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(vendors)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  // Fetch vendor rows
  const vendorRows = await db
    .select()
    .from(vendors)
    .where(where)
    .limit(limit)
    .offset(offset);

  if (vendorRows.length === 0) {
    return { vendors: [], meta: { page, total, limit } };
  }

  // Fetch services for all returned vendors
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

  // Group services by vendorId
  const servicesByVendor = new Map<string, ServiceRow[]>();
  for (const svc of allServices) {
    const list = servicesByVendor.get(svc.vendorId) ?? [];
    list.push(svc);
    servicesByVendor.set(svc.vendorId, list);
  }

  const result = vendorRows.map((v) =>
    mapVendorRow(v, servicesByVendor.get(v.id) ?? [], v.mongoPortfolioId),
  );

  return { vendors: result, meta: { page, total, limit } };
}

// ── getVendor ──────────────────────────────────────────────────────────────────

export async function getVendor(vendorId: string): Promise<
  (VendorProfile & { portfolio: PortfolioDoc | null }) | null
> {
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

  // MongoDB portfolio — guarded by USE_MOCK_SERVICES
  let portfolio: PortfolioDoc | null = null;

  if (env.USE_MOCK_SERVICES) {
    // Dev mode: return null so the frontend shows the empty state rather than mock copy
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

  const base = mapVendorRow(vendor, serviceRows, vendor.mongoPortfolioId);
  return { ...base, portfolio };
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

// ── addService ─────────────────────────────────────────────────────────────────

export async function addService(
  vendorId: string,
  userId: string,
  input: CreateServiceInput,
): Promise<VendorService> {
  // Verify ownership
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

export async function getAvailability(
  vendorId: string,
  month: string, // YYYY-MM
): Promise<string[]> {
  // Parse month into start/end date strings
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must be in YYYY-MM format');
  const [year, mon] = month.split('-') as [string, string];

  const start = `${year}-${mon}-01`;
  const nextMonth = parseInt(mon, 10) === 12
    ? `${parseInt(year, 10) + 1}-01-01`
    : `${year}-${String(parseInt(mon, 10) + 1).padStart(2, '0')}-01`;

  const rows = await db
    .select({ eventDate: bookings.eventDate })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'CONFIRMED'),
        sql`${bookings.eventDate} >= ${start}::date AND ${bookings.eventDate} < ${nextMonth}::date`,
      ),
    );

  // eventDate comes back as a string from Drizzle date column
  return rows.map((r) => r.eventDate as string);
}
