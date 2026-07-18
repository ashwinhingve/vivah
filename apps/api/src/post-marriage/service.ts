/**
 * Smart Shaadi — Post-marriage services (Phase 8, Unit 8.2)
 * apps/api/src/post-marriage/service.ts
 *
 * Browse, detail and admin CRUD over the post-marriage catalogue: editorial
 * categories, service partners, and the services they offer.
 *
 * Like Unit 8.1, partners may be seeded FICTIONAL inventory
 * (`is_placeholder = true`). The same contract applies: the flag is internal
 * provenance and never filters, hides or down-ranks a row — no query in this
 * file references it. Unlike 8.1 there is no booking path here at all; every
 * service converts through an enquiry, so there is nothing for the flag to gate
 * commercially and no `assertBookable()` equivalent is needed.
 */

import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  postMarriageCategories,
  postMarriageServices,
  servicePartners,
  cities,
} from '@smartshaadi/db';
import type {
  PostMarriageCategory,
  PostMarriageCategoryWithCount,
  PostMarriageService,
  PostMarriageServiceDetail,
  PostMarriageServiceListResult,
  ServicePartner,
} from '@smartshaadi/types';
import type {
  PostMarriageServiceListQuery,
  CreatePostMarriageCategoryInput,
  UpdatePostMarriageCategoryInput,
  CreateServicePartnerInput,
  UpdateServicePartnerInput,
  CreatePostMarriageServiceInput,
  UpdatePostMarriageServiceInput,
} from '@smartshaadi/schemas';

export class PostMarriageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PostMarriageError';
  }
}

type CategoryRow = typeof postMarriageCategories.$inferSelect;
type PartnerRow  = typeof servicePartners.$inferSelect;
type ServiceRow  = typeof postMarriageServices.$inferSelect;

// ── Row mappers ──────────────────────────────────────────────────────────────

function toCategory(row: CategoryRow): PostMarriageCategory {
  return {
    id:          row.id,
    slug:        row.slug,
    name:        row.name,
    description: row.description,
    icon:        row.icon,
    sortOrder:   row.sortOrder,
    isActive:    row.isActive,
  };
}

function toPartner(row: PartnerRow): ServicePartner {
  return {
    id:         row.id,
    categoryId: row.categoryId,
    name:       row.name,
    slug:       row.slug,
    city:        row.city,
    cityId:      row.cityId,
    state:       row.state,
    countryCode: row.countryCode,
    description:  row.description,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    websiteUrl:   row.websiteUrl,
    logoUrl:      row.logoUrl,
    rating:       row.rating,
    isPlaceholder: row.isPlaceholder,
    isActive:      row.isActive,
    createdAt:     row.createdAt.toISOString(),
    updatedAt:     row.updatedAt.toISOString(),
  };
}

function toService(row: ServiceRow): PostMarriageService {
  return {
    id:          row.id,
    partnerId:   row.partnerId,
    categoryId:  row.categoryId,
    title:       row.title,
    slug:        row.slug,
    description: row.description,
    // Decimal strings, not parsed — same reasoning as premium_packages.priceFrom.
    priceFrom: row.priceFrom,
    priceTo:   row.priceTo,
    priceUnit: row.priceUnit,
    currency:  row.currency,
    isPlaceholder: row.isPlaceholder,
    isActive:      row.isActive,
    sortOrder:     row.sortOrder,
    createdAt:     row.createdAt.toISOString(),
    updatedAt:     row.updatedAt.toISOString(),
  };
}

// ── Categories ───────────────────────────────────────────────────────────────

/**
 * Active categories with a live service count.
 *
 * The count is a correlated subquery rather than a GROUP BY join so categories
 * with zero services still appear (an admin needs to see an empty category to
 * fix it); a plain inner join would drop them.
 */
export async function listCategories(): Promise<PostMarriageCategoryWithCount[]> {
  const rows = await db
    .select({
      cat: postMarriageCategories,
      serviceCount: sql<number>`(
        SELECT cast(count(*) as integer) FROM ${postMarriageServices}
        WHERE ${postMarriageServices.categoryId} = ${postMarriageCategories.id}
          AND ${postMarriageServices.isActive} = true
      )`,
    })
    .from(postMarriageCategories)
    .where(eq(postMarriageCategories.isActive, true))
    .orderBy(asc(postMarriageCategories.sortOrder), asc(postMarriageCategories.name));

  return rows.map((r) => ({ ...toCategory(r.cat), serviceCount: r.serviceCount }));
}

export async function createCategory(
  input: CreatePostMarriageCategoryInput,
): Promise<PostMarriageCategory> {
  try {
    const [inserted] = await db
      .insert(postMarriageCategories)
      .values({
        slug:        input.slug,
        name:        input.name,
        description: input.description ?? null,
        icon:        input.icon ?? null,
        sortOrder:   input.sortOrder,
        isActive:    input.isActive,
      })
      .returning();
    if (!inserted) throw new PostMarriageError('INSERT_FAILED', 'Failed to create category');
    return toCategory(inserted);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', `A category with slug "${input.slug}" already exists`);
    }
    throw e;
  }
}

export async function updateCategory(
  id: string,
  input: UpdatePostMarriageCategoryInput,
): Promise<PostMarriageCategory> {
  const patch: Partial<typeof postMarriageCategories.$inferInsert> = { updatedAt: new Date() };
  if (input.slug        !== undefined) patch.slug = input.slug;
  if (input.name        !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon        !== undefined) patch.icon = input.icon;
  if (input.sortOrder   !== undefined) patch.sortOrder = input.sortOrder;
  if (input.isActive    !== undefined) patch.isActive = input.isActive;

  try {
    const [updated] = await db
      .update(postMarriageCategories)
      .set(patch)
      .where(eq(postMarriageCategories.id, id))
      .returning();
    if (!updated) throw new PostMarriageError('NOT_FOUND', 'Category not found');
    return toCategory(updated);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', 'A category with that slug already exists');
    }
    throw e;
  }
}

/**
 * Deactivate rather than delete. The FK from services/partners is ON DELETE
 * RESTRICT, so a hard delete of a populated category fails at the database
 * anyway — deactivating expresses the same intent without the error.
 */
export async function deactivateCategory(id: string): Promise<void> {
  const result = await db
    .update(postMarriageCategories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(postMarriageCategories.id, id))
    .returning({ id: postMarriageCategories.id });
  if (result.length === 0) throw new PostMarriageError('NOT_FOUND', 'Category not found');
}

// ── Service browse ───────────────────────────────────────────────────────────

export async function listServices(
  query: PostMarriageServiceListQuery,
): Promise<PostMarriageServiceListResult> {
  const filters: SQL[] = [
    eq(postMarriageServices.isActive, true),
    // A service whose partner has been retired must not keep appearing.
    eq(servicePartners.isActive, true),
  ];

  if (query.category) filters.push(eq(postMarriageCategories.slug, query.category));
  if (query.city)     filters.push(eq(servicePartners.city, query.city));

  if (query.q) {
    const term = `%${query.q}%`;
    const match = or(
      ilike(postMarriageServices.title, term),
      ilike(postMarriageServices.description, term),
      ilike(servicePartners.name, term),
    );
    if (match) filters.push(match);
  }

  // price_from is NULLable here (a QUOTE service has no number). A NULL fails
  // every comparison, so quote-only services correctly drop out of a price-
  // filtered search rather than being silently treated as free.
  if (query.priceMin !== undefined) {
    filters.push(sql`${postMarriageServices.priceFrom} >= ${query.priceMin}`);
  }
  if (query.priceMax !== undefined) {
    filters.push(sql`${postMarriageServices.priceFrom} <= ${query.priceMax}`);
  }

  const where = and(...filters);

  const orderBy = (() => {
    switch (query.sort) {
      // NULLS LAST so quote-priced services sort to the end of a price sort
      // instead of leading it (pg sorts NULL first on ASC by default).
      case 'PRICE_ASC':  return [sql`${postMarriageServices.priceFrom} ASC NULLS LAST`];
      case 'PRICE_DESC': return [sql`${postMarriageServices.priceFrom} DESC NULLS LAST`];
      default:
        return [asc(postMarriageServices.sortOrder), desc(postMarriageServices.createdAt)];
    }
  })();

  const offset = (query.page - 1) * query.limit;

  const rows = await db
    .select({
      svc:          postMarriageServices,
      partnerName:  servicePartners.name,
      partnerSlug:  servicePartners.slug,
      partnerCity:  servicePartners.city,
      partnerRating: servicePartners.rating,
      partnerLogoUrl: servicePartners.logoUrl,
      categoryName: postMarriageCategories.name,
      categorySlug: postMarriageCategories.slug,
    })
    .from(postMarriageServices)
    .innerJoin(servicePartners, eq(postMarriageServices.partnerId, servicePartners.id))
    .innerJoin(postMarriageCategories, eq(postMarriageServices.categoryId, postMarriageCategories.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(query.limit)
    .offset(offset);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(postMarriageServices)
    .innerJoin(servicePartners, eq(postMarriageServices.partnerId, servicePartners.id))
    .innerJoin(postMarriageCategories, eq(postMarriageServices.categoryId, postMarriageCategories.id))
    .where(where);

  return {
    services: rows.map((r) => ({
      ...toService(r.svc),
      partnerName:   r.partnerName,
      partnerSlug:   r.partnerSlug,
      partnerCity:   r.partnerCity,
      partnerRating: r.partnerRating,
      partnerLogoUrl: r.partnerLogoUrl,
      categoryName:  r.categoryName,
      categorySlug:  r.categorySlug,
    })),
    total: countRow?.total ?? 0,
    page:  query.page,
    limit: query.limit,
  };
}

/** Cities that currently have active service supply, for the browse filter. */
export async function listServiceCities(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: servicePartners.city })
    .from(servicePartners)
    .where(eq(servicePartners.isActive, true))
    .orderBy(asc(servicePartners.city));
  // city is nullable — remote-delivered partners have none, and a null must not
  // become an empty filter chip.
  return rows.map((r) => r.city).filter((c): c is string => c !== null);
}

export async function getServiceBySlug(
  slug: string,
  opts: { includeInactive?: boolean } = {},
): Promise<PostMarriageServiceDetail> {
  const [row] = await db
    .select({
      svc:     postMarriageServices,
      partner: servicePartners,
      categoryName: postMarriageCategories.name,
      categorySlug: postMarriageCategories.slug,
    })
    .from(postMarriageServices)
    .innerJoin(servicePartners, eq(postMarriageServices.partnerId, servicePartners.id))
    .innerJoin(postMarriageCategories, eq(postMarriageServices.categoryId, postMarriageCategories.id))
    .where(eq(postMarriageServices.slug, slug))
    .limit(1);

  if (!row) throw new PostMarriageError('NOT_FOUND', 'Service not found');
  if ((!row.svc.isActive || !row.partner.isActive) && !opts.includeInactive) {
    throw new PostMarriageError('NOT_FOUND', 'Service not found');
  }

  const related = await db
    .select()
    .from(postMarriageServices)
    .where(and(
      eq(postMarriageServices.partnerId, row.partner.id),
      eq(postMarriageServices.isActive, true),
    ))
    .orderBy(asc(postMarriageServices.sortOrder))
    .limit(6);

  return {
    ...toService(row.svc),
    partnerName:    row.partner.name,
    partnerSlug:    row.partner.slug,
    partnerCity:    row.partner.city,
    partnerRating:  row.partner.rating,
    partnerLogoUrl: row.partner.logoUrl,
    categoryName:   row.categoryName,
    categorySlug:   row.categorySlug,
    partner:        toPartner(row.partner),
    // Exclude the service being viewed from its own "more from this partner".
    relatedServices: related.filter((r) => r.id !== row.svc.id).map(toService),
  };
}

// ── Partner CRUD (admin) ─────────────────────────────────────────────────────

export async function listPartnersForAdmin(
  page = 1,
  limit = 50,
): Promise<{ partners: ServicePartner[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;
  const rows = await db
    .select()
    .from(servicePartners)
    .orderBy(asc(servicePartners.name))
    .limit(limit)
    .offset(offset);
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(servicePartners);
  return { partners: rows.map(toPartner), total: countRow?.total ?? 0, page, limit };
}

export async function createPartner(
  input: CreateServicePartnerInput,
): Promise<ServicePartner> {
  await assertCategoryExists(input.categoryId);
  try {
    const [inserted] = await db
      .insert(servicePartners)
      .values({
        categoryId: input.categoryId,
        name:       input.name,
        slug:       input.slug,
        city:        input.city ?? null,
        // Same registry resolution as 8.1 packages, so a partner and a package
        // in the same city link to the same row.
        cityId:      input.city ? await resolveCityId(input.city) : null,
        state:       input.state ?? null,
        countryCode: input.countryCode,
        description:  input.description ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        websiteUrl:   input.websiteUrl ?? null,
        logoUrl:      input.logoUrl ?? null,
        rating:        String(input.rating),
        isPlaceholder: input.isPlaceholder,
        isActive:      input.isActive,
      })
      .returning();
    if (!inserted) throw new PostMarriageError('INSERT_FAILED', 'Failed to create partner');
    return toPartner(inserted);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', `A partner with slug "${input.slug}" already exists`);
    }
    throw e;
  }
}

export async function updatePartner(
  id: string,
  input: UpdateServicePartnerInput,
): Promise<ServicePartner> {
  if (input.categoryId !== undefined) await assertCategoryExists(input.categoryId);

  const patch: Partial<typeof servicePartners.$inferInsert> = { updatedAt: new Date() };
  if (input.categoryId   !== undefined) patch.categoryId = input.categoryId;
  if (input.name         !== undefined) patch.name = input.name;
  if (input.slug         !== undefined) patch.slug = input.slug;
  if (input.city         !== undefined) {
    patch.city = input.city;
    // Re-resolve on rename, or the row keeps pointing at its previous city.
    patch.cityId = input.city ? await resolveCityId(input.city) : null;
  }
  if (input.state        !== undefined) patch.state = input.state;
  if (input.countryCode  !== undefined) patch.countryCode = input.countryCode;
  if (input.description  !== undefined) patch.description = input.description;
  if (input.contactEmail !== undefined) patch.contactEmail = input.contactEmail;
  if (input.contactPhone !== undefined) patch.contactPhone = input.contactPhone;
  if (input.websiteUrl   !== undefined) patch.websiteUrl = input.websiteUrl;
  if (input.logoUrl      !== undefined) patch.logoUrl = input.logoUrl;
  if (input.rating       !== undefined) patch.rating = String(input.rating);
  if (input.isPlaceholder !== undefined) patch.isPlaceholder = input.isPlaceholder;
  if (input.isActive      !== undefined) patch.isActive = input.isActive;

  try {
    const [updated] = await db
      .update(servicePartners)
      .set(patch)
      .where(eq(servicePartners.id, id))
      .returning();
    if (!updated) throw new PostMarriageError('NOT_FOUND', 'Partner not found');
    return toPartner(updated);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', 'A partner with that slug already exists');
    }
    throw e;
  }
}

export async function deactivatePartner(id: string): Promise<void> {
  const result = await db
    .update(servicePartners)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(servicePartners.id, id))
    .returning({ id: servicePartners.id });
  if (result.length === 0) throw new PostMarriageError('NOT_FOUND', 'Partner not found');
}

// ── Service CRUD (admin) ─────────────────────────────────────────────────────

export async function createService(
  input: CreatePostMarriageServiceInput,
): Promise<PostMarriageService> {
  await assertCategoryExists(input.categoryId);
  const [partner] = await db
    .select({ id: servicePartners.id })
    .from(servicePartners)
    .where(eq(servicePartners.id, input.partnerId))
    .limit(1);
  if (!partner) throw new PostMarriageError('NOT_FOUND', 'Partner not found');

  try {
    const [inserted] = await db
      .insert(postMarriageServices)
      .values({
        partnerId:   input.partnerId,
        categoryId:  input.categoryId,
        title:       input.title,
        slug:        input.slug,
        description: input.description ?? null,
        priceFrom:   input.priceFrom ?? null,
        priceTo:     input.priceTo ?? null,
        priceUnit:   input.priceUnit,
        currency:    input.currency,
        isPlaceholder: input.isPlaceholder,
        isActive:      input.isActive,
        sortOrder:     input.sortOrder,
      })
      .returning();
    if (!inserted) throw new PostMarriageError('INSERT_FAILED', 'Failed to create service');
    return toService(inserted);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', `A service with slug "${input.slug}" already exists`);
    }
    throw e;
  }
}

export async function updateService(
  id: string,
  input: UpdatePostMarriageServiceInput,
): Promise<PostMarriageService> {
  if (input.categoryId !== undefined) await assertCategoryExists(input.categoryId);

  const patch: Partial<typeof postMarriageServices.$inferInsert> = { updatedAt: new Date() };
  if (input.partnerId   !== undefined) patch.partnerId = input.partnerId;
  if (input.categoryId  !== undefined) patch.categoryId = input.categoryId;
  if (input.title       !== undefined) patch.title = input.title;
  if (input.slug        !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priceFrom   !== undefined) patch.priceFrom = input.priceFrom;
  if (input.priceTo     !== undefined) patch.priceTo = input.priceTo;
  if (input.priceUnit   !== undefined) patch.priceUnit = input.priceUnit;
  if (input.currency    !== undefined) patch.currency = input.currency;
  if (input.isPlaceholder !== undefined) patch.isPlaceholder = input.isPlaceholder;
  if (input.isActive      !== undefined) patch.isActive = input.isActive;
  if (input.sortOrder     !== undefined) patch.sortOrder = input.sortOrder;

  try {
    const [updated] = await db
      .update(postMarriageServices)
      .set(patch)
      .where(eq(postMarriageServices.id, id))
      .returning();
    if (!updated) throw new PostMarriageError('NOT_FOUND', 'Service not found');
    return toService(updated);
  } catch (e) {
    if (isPgError(e, '23505')) {
      throw new PostMarriageError('CONFLICT', 'A service with that slug already exists');
    }
    throw e;
  }
}

export async function deactivateService(id: string): Promise<void> {
  const result = await db
    .update(postMarriageServices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(postMarriageServices.id, id))
    .returning({ id: postMarriageServices.id });
  if (result.length === 0) throw new PostMarriageError('NOT_FOUND', 'Service not found');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up a city in the admin-managed registry by name. Case-insensitive and
 * trimmed, matching migration 0039's backfill rule exactly — two matching rules
 * for one link is how the representations drift apart. Null is a legal result:
 * remote-delivered partners have no city, and an unregistered one still renders
 * from free text.
 */
async function resolveCityId(cityName: string): Promise<string | null> {
  const [row] = await db
    .select({ id: cities.id })
    .from(cities)
    .where(sql`lower(trim(${cities.name})) = lower(trim(${cityName}))`)
    .limit(1);
  return row?.id ?? null;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const [cat] = await db
    .select({ id: postMarriageCategories.id })
    .from(postMarriageCategories)
    .where(eq(postMarriageCategories.id, categoryId))
    .limit(1);
  if (!cat) throw new PostMarriageError('NOT_FOUND', 'Category not found');
}

function isPgError(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e
    && (e as { code?: unknown }).code === code;
}
