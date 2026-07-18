/**
 * Smart Shaadi — Premium package supply service (Phase 8, Unit 8.1)
 * apps/api/src/packages/service.ts
 *
 * Browse, detail and admin CRUD over `premium_packages`.
 *
 * ── The placeholder rule, in one place ───────────────────────────────────────
 *
 * Packages may be seeded FICTIONAL inventory (`is_placeholder = true`) standing
 * in until a real venue partner is onboarded. That flag is internal provenance:
 * it does NOT filter, hide or down-rank a row anywhere in this file, and the
 * browse/detail queries deliberately never mention it.
 *
 * It gates exactly one thing — `assertBookable()` below. A fictional venue
 * cannot deliver a wedding, so no booking or payment may be raised against it.
 * Enquiries stay fully open, because a captured lead is exactly what placeholder
 * inventory is for.
 *
 * Promoting seed inventory to a real partner is `UPDATE ... SET is_placeholder =
 * false`. No schema change, no re-keying, no broken references.
 */

import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  premiumPackages,
  premiumPackageInclusions,
  premiumPackageAvailability,
  vendors,
} from '@smartshaadi/db';
import type {
  PremiumPackage,
  PremiumPackageDetail,
  PremiumPackageWithVendor,
  PremiumPackageListResult,
  PremiumPackageFacets,
  PackageInclusion,
  PackageAvailabilityBlock,
  PremiumPackageTier,
} from '@smartshaadi/types';
import type {
  PremiumPackageListQuery,
  CreatePremiumPackageInput,
  UpdatePremiumPackageInput,
} from '@smartshaadi/schemas';

export class PackageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PackageError';
  }
}

type PackageRow    = typeof premiumPackages.$inferSelect;
type InclusionRow  = typeof premiumPackageInclusions.$inferSelect;
type AvailabilityRow = typeof premiumPackageAvailability.$inferSelect;

// ── Row mappers ──────────────────────────────────────────────────────────────

function toPackage(row: PackageRow): PremiumPackage {
  return {
    id:       row.id,
    vendorId: row.vendorId,
    slug:     row.slug,
    title:    row.title,
    tier:     row.tier,
    destinationCity: row.destinationCity,
    countryCode:     row.countryCode,
    // priceFrom arrives from pg as a STRING and stays one. numeric(12,2) exceeds
    // float64's exact range; parsing here would silently round large amounts.
    priceFrom: row.priceFrom,
    currency:  row.currency,
    guestCapacityMin: row.guestCapacityMin,
    guestCapacityMax: row.guestCapacityMax,
    durationNights:   row.durationNights,
    summary:      row.summary,
    description:  row.description,
    heroImageUrl: row.heroImageUrl,
    isPlaceholder: row.isPlaceholder,
    isActive:      row.isActive,
    sortOrder:     row.sortOrder,
    createdAt:     row.createdAt.toISOString(),
    updatedAt:     row.updatedAt.toISOString(),
  };
}

function toInclusion(row: InclusionRow): PackageInclusion {
  return {
    id:        row.id,
    packageId: row.packageId,
    kind:      row.kind,
    label:     row.label,
    sortOrder: row.sortOrder,
  };
}

function toAvailability(row: AvailabilityRow): PackageAvailabilityBlock {
  return {
    id:          row.id,
    packageId:   row.packageId,
    blockedFrom: row.blockedFrom,
    blockedTo:   row.blockedTo,
    reason:      row.reason,
  };
}

// ── The one behaviour is_placeholder gates ───────────────────────────────────

/**
 * Throws unless `packageId` may have money raised against it.
 *
 * Call this from any future booking/payment path for a package. It is the ONLY
 * place `is_placeholder` changes behaviour, and it lives in the service layer
 * rather than the UI so a direct API call is refused too — a guard that only
 * exists in a React component is not a guard.
 *
 * Deliberately returns the package on success so callers do not re-query.
 */
export async function assertBookable(packageId: string): Promise<PremiumPackage> {
  const [row] = await db
    .select()
    .from(premiumPackages)
    .where(eq(premiumPackages.id, packageId))
    .limit(1);

  if (!row) throw new PackageError('NOT_FOUND', 'Package not found');
  if (!row.isActive) {
    throw new PackageError('INVALID_STATE', 'This package is no longer available');
  }
  if (row.isPlaceholder) {
    throw new PackageError(
      'PLACEHOLDER_SUPPLY',
      'This package is a preview listing and cannot be booked yet. '
      + 'Send an enquiry and our team will confirm availability with the venue.',
    );
  }
  return toPackage(row);
}

// ── Browse ───────────────────────────────────────────────────────────────────

/**
 * Paginated browse. Note what is NOT here: no `is_placeholder` predicate.
 * Placeholder inventory ranks and renders exactly like real inventory.
 */
export async function listPackages(
  query: PremiumPackageListQuery,
): Promise<PremiumPackageListResult> {
  const filters: SQL[] = [eq(premiumPackages.isActive, true)];

  if (query.city)  filters.push(eq(premiumPackages.destinationCity, query.city));
  if (query.tier)  filters.push(eq(premiumPackages.tier, query.tier));

  if (query.q) {
    const term = `%${query.q}%`;
    const match = or(
      ilike(premiumPackages.title, term),
      ilike(premiumPackages.summary, term),
      ilike(premiumPackages.destinationCity, term),
      ilike(vendors.businessName, term),
    );
    if (match) filters.push(match);
  }

  // "I have N guests" — the package must be able to seat them, and must not
  // have a minimum above them. One input, matched against the stored range.
  if (query.capacity !== undefined) {
    filters.push(gte(premiumPackages.guestCapacityMax, query.capacity));
    filters.push(lte(premiumPackages.guestCapacityMin, query.capacity));
  }

  // priceFrom is numeric; comparing it to a JS number needs an explicit cast or
  // pg compares text. Drizzle's decimal columns are strings, so we build the
  // comparison in SQL rather than through gte/lte on a string column.
  if (query.priceMin !== undefined) {
    filters.push(sql`${premiumPackages.priceFrom} >= ${query.priceMin}`);
  }
  if (query.priceMax !== undefined) {
    filters.push(sql`${premiumPackages.priceFrom} <= ${query.priceMax}`);
  }

  const where = and(...filters);

  const orderBy = (() => {
    switch (query.sort) {
      case 'PRICE_ASC':     return [asc(premiumPackages.priceFrom)];
      case 'PRICE_DESC':    return [desc(premiumPackages.priceFrom)];
      case 'CAPACITY_DESC': return [desc(premiumPackages.guestCapacityMax)];
      default:
        // Editorial order first, then newest — stable and admin-controllable.
        return [asc(premiumPackages.sortOrder), desc(premiumPackages.createdAt)];
    }
  })();

  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      pkg:            premiumPackages,
      vendorName:     vendors.businessName,
      vendorCity:     vendors.city,
      vendorVerified: vendors.verified,
      vendorRating:   vendors.rating,
    })
    .from(premiumPackages)
    .innerJoin(vendors, eq(premiumPackages.vendorId, vendors.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(query.limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(premiumPackages)
    .innerJoin(vendors, eq(premiumPackages.vendorId, vendors.id))
    .where(where);

  return {
    packages: rows.map((r) => ({
      ...toPackage(r.pkg),
      vendorName:     r.vendorName,
      vendorCity:     r.vendorCity,
      vendorVerified: r.vendorVerified,
      vendorRating:   r.vendorRating,
    })),
    total: countRow?.total ?? 0,
    page:  query.page,
    limit: query.limit,
  };
}

/**
 * Distinct cities and tiers that currently have active inventory, so the browse
 * chips can never offer a filter that returns an empty page.
 */
export async function getFacets(): Promise<PremiumPackageFacets> {
  const cityRows = await db
    .selectDistinct({ city: premiumPackages.destinationCity })
    .from(premiumPackages)
    .where(eq(premiumPackages.isActive, true))
    .orderBy(asc(premiumPackages.destinationCity));

  const tierRows = await db
    .selectDistinct({ tier: premiumPackages.tier })
    .from(premiumPackages)
    .where(eq(premiumPackages.isActive, true));

  const TIER_ORDER: PremiumPackageTier[] = ['ESSENTIAL', 'SIGNATURE', 'LUXE'];

  return {
    cities: cityRows.map((r) => r.city),
    tiers:  TIER_ORDER.filter((t) => tierRows.some((r) => r.tier === t)),
  };
}

// ── Detail ───────────────────────────────────────────────────────────────────

/** Detail by public slug. Inactive packages 404 for non-admin readers. */
export async function getPackageBySlug(
  slug: string,
  opts: { includeInactive?: boolean } = {},
): Promise<PremiumPackageDetail> {
  const [row] = await db
    .select({
      pkg:            premiumPackages,
      vendorName:     vendors.businessName,
      vendorCity:     vendors.city,
      vendorVerified: vendors.verified,
      vendorRating:   vendors.rating,
    })
    .from(premiumPackages)
    .innerJoin(vendors, eq(premiumPackages.vendorId, vendors.id))
    .where(eq(premiumPackages.slug, slug))
    .limit(1);

  if (!row) throw new PackageError('NOT_FOUND', 'Package not found');
  if (!row.pkg.isActive && !opts.includeInactive) {
    throw new PackageError('NOT_FOUND', 'Package not found');
  }

  const [inclusionRows, availabilityRows] = await Promise.all([
    db.select().from(premiumPackageInclusions)
      .where(eq(premiumPackageInclusions.packageId, row.pkg.id))
      .orderBy(asc(premiumPackageInclusions.sortOrder)),
    db.select().from(premiumPackageAvailability)
      .where(eq(premiumPackageAvailability.packageId, row.pkg.id))
      .orderBy(asc(premiumPackageAvailability.blockedFrom)),
  ]);

  const all = inclusionRows.map(toInclusion);

  return {
    ...toPackage(row.pkg),
    vendorName:     row.vendorName,
    vendorCity:     row.vendorCity,
    vendorVerified: row.vendorVerified,
    vendorRating:   row.vendorRating,
    inclusions: all.filter((i) => i.kind === 'INCLUSION'),
    exclusions: all.filter((i) => i.kind === 'EXCLUSION'),
    availability: availabilityRows.map(toAvailability),
  };
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a package and, in the same transaction, its inclusion and availability
 * children. A package that half-exists — priced but with no inclusion list —
 * would render as a broken detail page, so all three writes commit together.
 */
export async function createPackage(
  input: CreatePremiumPackageInput,
): Promise<PremiumPackageDetail> {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.id, input.vendorId))
    .limit(1);
  if (!vendor) throw new PackageError('NOT_FOUND', 'Vendor not found');

  const slug = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(premiumPackages)
      .values({
        vendorId:        input.vendorId,
        slug:            input.slug,
        title:           input.title,
        tier:            input.tier,
        destinationCity: input.destinationCity,
        countryCode:     input.countryCode,
        priceFrom:       input.priceFrom,
        currency:        input.currency,
        guestCapacityMin: input.guestCapacityMin,
        guestCapacityMax: input.guestCapacityMax,
        durationNights:   input.durationNights,
        summary:      input.summary ?? null,
        description:  input.description ?? null,
        heroImageUrl: input.heroImageUrl ?? null,
        isPlaceholder: input.isPlaceholder,
        isActive:      input.isActive,
        sortOrder:     input.sortOrder,
      })
      .returning();

    if (!inserted) throw new PackageError('INSERT_FAILED', 'Failed to create package');

    if (input.inclusions?.length) {
      await tx.insert(premiumPackageInclusions).values(
        input.inclusions.map((i) => ({
          packageId: inserted.id,
          kind:      i.kind,
          label:     i.label,
          sortOrder: i.sortOrder,
        })),
      );
    }

    if (input.availability?.length) {
      await tx.insert(premiumPackageAvailability).values(
        input.availability.map((a) => ({
          packageId:   inserted.id,
          blockedFrom: a.blockedFrom,
          blockedTo:   a.blockedTo,
          reason:      a.reason ?? null,
        })),
      );
    }

    return inserted.slug;
  }).catch((e: unknown) => {
    // 23505 = unique_violation. The slug is the only unique key here, and a
    // clashing slug is a user-correctable mistake, not a 500.
    if (isPgError(e, '23505')) {
      throw new PackageError('CONFLICT', `A package with slug "${input.slug}" already exists`);
    }
    throw e;
  });

  return getPackageBySlug(slug, { includeInactive: true });
}

/**
 * Update a package. Child collections are REPLACED wholesale when supplied
 * (delete-then-insert inside the transaction) rather than diffed: the admin form
 * posts the complete list, and a partial diff would silently keep rows the
 * editor believed they had removed.
 */
export async function updatePackage(
  id: string,
  input: UpdatePremiumPackageInput,
): Promise<PremiumPackageDetail> {
  const [existing] = await db
    .select({ id: premiumPackages.id })
    .from(premiumPackages)
    .where(eq(premiumPackages.id, id))
    .limit(1);
  if (!existing) throw new PackageError('NOT_FOUND', 'Package not found');

  const slug = await db.transaction(async (tx) => {
    const patch: Partial<typeof premiumPackages.$inferInsert> = { updatedAt: new Date() };

    if (input.slug            !== undefined) patch.slug = input.slug;
    if (input.title           !== undefined) patch.title = input.title;
    if (input.tier            !== undefined) patch.tier = input.tier;
    if (input.destinationCity !== undefined) patch.destinationCity = input.destinationCity;
    if (input.countryCode     !== undefined) patch.countryCode = input.countryCode;
    if (input.priceFrom       !== undefined) patch.priceFrom = input.priceFrom;
    if (input.currency        !== undefined) patch.currency = input.currency;
    if (input.guestCapacityMin !== undefined) patch.guestCapacityMin = input.guestCapacityMin;
    if (input.guestCapacityMax !== undefined) patch.guestCapacityMax = input.guestCapacityMax;
    if (input.durationNights   !== undefined) patch.durationNights = input.durationNights;
    if (input.summary        !== undefined) patch.summary = input.summary;
    if (input.description    !== undefined) patch.description = input.description;
    if (input.heroImageUrl   !== undefined) patch.heroImageUrl = input.heroImageUrl;
    if (input.isPlaceholder  !== undefined) patch.isPlaceholder = input.isPlaceholder;
    if (input.isActive       !== undefined) patch.isActive = input.isActive;
    if (input.sortOrder      !== undefined) patch.sortOrder = input.sortOrder;

    const [updated] = await tx
      .update(premiumPackages)
      .set(patch)
      .where(eq(premiumPackages.id, id))
      .returning();

    if (!updated) throw new PackageError('NOT_FOUND', 'Package not found');

    if (input.inclusions !== undefined) {
      await tx.delete(premiumPackageInclusions)
        .where(eq(premiumPackageInclusions.packageId, id));
      if (input.inclusions.length) {
        await tx.insert(premiumPackageInclusions).values(
          input.inclusions.map((i) => ({
            packageId: id, kind: i.kind, label: i.label, sortOrder: i.sortOrder,
          })),
        );
      }
    }

    if (input.availability !== undefined) {
      await tx.delete(premiumPackageAvailability)
        .where(eq(premiumPackageAvailability.packageId, id));
      if (input.availability.length) {
        await tx.insert(premiumPackageAvailability).values(
          input.availability.map((a) => ({
            packageId: id, blockedFrom: a.blockedFrom, blockedTo: a.blockedTo,
            reason: a.reason ?? null,
          })),
        );
      }
    }

    return updated.slug;
  }).catch((e: unknown) => {
    if (isPgError(e, '23505')) {
      throw new PackageError('CONFLICT', 'A package with that slug already exists');
    }
    throw e;
  });

  return getPackageBySlug(slug, { includeInactive: true });
}

/**
 * Soft delete. A hard DELETE would cascade the package's enquiries away, and an
 * enquiry is a captured lead that must outlive the listing it came from.
 */
export async function deactivatePackage(id: string): Promise<void> {
  const result = await db
    .update(premiumPackages)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(premiumPackages.id, id))
    .returning({ id: premiumPackages.id });

  if (result.length === 0) throw new PackageError('NOT_FOUND', 'Package not found');
}

/** Admin listing — includes inactive rows, which the public browse excludes. */
export async function listAllPackagesForAdmin(
  page = 1,
  limit = 50,
): Promise<PremiumPackageListResult> {
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      pkg:            premiumPackages,
      vendorName:     vendors.businessName,
      vendorCity:     vendors.city,
      vendorVerified: vendors.verified,
      vendorRating:   vendors.rating,
    })
    .from(premiumPackages)
    .innerJoin(vendors, eq(premiumPackages.vendorId, vendors.id))
    .orderBy(asc(premiumPackages.sortOrder), desc(premiumPackages.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(premiumPackages);

  const packages: PremiumPackageWithVendor[] = rows.map((r) => ({
    ...toPackage(r.pkg),
    vendorName:     r.vendorName,
    vendorCity:     r.vendorCity,
    vendorVerified: r.vendorVerified,
    vendorRating:   r.vendorRating,
  }));

  return { packages, total: countRow?.total ?? 0, page, limit };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Narrow an unknown thrown value to a pg driver error with a given SQLSTATE. */
function isPgError(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e
    && (e as { code?: unknown }).code === code;
}
