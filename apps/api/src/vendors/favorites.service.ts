/**
 * Vendor favorites — save/unsave + listing.
 * Mirrors a denormalized favoriteCount on the vendors table.
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { vendorFavorites, vendors, vendorServices } from '@smartshaadi/db';
import type { VendorProfile } from '@smartshaadi/types';

export class FavoriteError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FavoriteError';
  }
}

export async function addFavorite(userId: string, vendorId: string): Promise<{ favorited: boolean }> {
  const [v] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) throw new FavoriteError('NOT_FOUND', 'Vendor not found');

  // Idempotent — no-op if already favorited (uniqueIndex protects)
  const existing = await db
    .select({ id: vendorFavorites.id })
    .from(vendorFavorites)
    .where(and(eq(vendorFavorites.userId, userId), eq(vendorFavorites.vendorId, vendorId)))
    .limit(1);

  if (existing.length > 0) return { favorited: true };

  await db.insert(vendorFavorites).values({ userId, vendorId });
  await db
    .update(vendors)
    .set({ favoriteCount: sql`${vendors.favoriteCount} + 1` })
    .where(eq(vendors.id, vendorId));

  return { favorited: true };
}

export async function removeFavorite(userId: string, vendorId: string): Promise<{ favorited: boolean }> {
  const result = await db
    .delete(vendorFavorites)
    .where(and(eq(vendorFavorites.userId, userId), eq(vendorFavorites.vendorId, vendorId)))
    .returning({ id: vendorFavorites.id });

  if (result.length > 0) {
    await db
      .update(vendors)
      .set({ favoriteCount: sql`GREATEST(${vendors.favoriteCount} - 1, 0)` })
      .where(eq(vendors.id, vendorId));
  }

  return { favorited: false };
}

export async function listFavorites(userId: string): Promise<VendorProfile[]> {
  const favs = await db
    .select({ vendor: vendors })
    .from(vendorFavorites)
    .innerJoin(vendors, eq(vendors.id, vendorFavorites.vendorId))
    .where(eq(vendorFavorites.userId, userId))
    .orderBy(desc(vendorFavorites.createdAt));

  if (favs.length === 0) return [];

  const vendorIds = favs.map((f) => f.vendor.id);
  const services = await db
    .select()
    .from(vendorServices)
    .where(and(inArray(vendorServices.vendorId, vendorIds), eq(vendorServices.isActive, true)));

  const svcByVendor = new Map<string, typeof services>();
  for (const s of services) {
    const list = svcByVendor.get(s.vendorId) ?? [];
    list.push(s);
    svcByVendor.set(s.vendorId, list);
  }

  return favs.map(({ vendor: v }) => ({
    id:               v.id,
    businessName:     v.businessName,
    category:         v.category as VendorProfile['category'],
    city:             v.city,
    state:            v.state,
    rating:           v.rating != null ? parseFloat(v.rating) : 0,
    totalReviews:     v.totalReviews,
    verified:         v.verified,
    services:         (svcByVendor.get(v.id) ?? []).map((s) => ({
      id:          s.id,
      name:        s.name,
      priceFrom:   s.priceFrom != null ? parseFloat(s.priceFrom) : 0,
      priceTo:     s.priceTo != null ? parseFloat(s.priceTo) : null,
      unit:        s.priceUnit ?? 'PER_EVENT',
      description: s.description,
    })),
    portfolioKey:     v.mongoPortfolioId,
    tagline:          v.tagline,
    description:      v.description,
    coverImageKey:    v.coverImageKey,
    phone:            v.phone,
    email:            v.email,
    website:          v.website,
    instagram:        v.instagram,
    yearsActive:      v.yearsActive,
    responseTimeHours: v.responseTimeHours,
    priceMin:         v.priceMin != null ? parseFloat(v.priceMin) : null,
    priceMax:         v.priceMax != null ? parseFloat(v.priceMax) : null,
    viewCount:        v.viewCount,
    favoriteCount:    v.favoriteCount,
    isFavorite:       true,
  }));
}
