/**
 * Smart Shaadi — Product Service
 *
 * Handles product catalogue for the e-commerce store.
 *
 * Rule 12 note: products.vendorId → vendors.id (uuid)
 *               vendors.userId → user.id (TEXT) — resolve userId → vendor before vendor-keyed ops
 *               orders.customerId → user.id (TEXT) — passes through directly
 */

import { and, eq, ilike, gte, lte, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { products, vendors } from '@smartshaadi/db';
import type { ProductSummary } from '@smartshaadi/types';
import type {
  ProductListQuery,
  CreateProductInput,
  UpdateProductInput,
  UpdateStockInput,
} from '@smartshaadi/schemas';

// ── Typed error factory ───────────────────────────────────────────────────────

function makeError(
  code: string,
  message: string,
  status: number,
): Error & { code: string; status: number } {
  const e = new Error(message) as Error & { code: string; status: number };
  e.code   = code;
  e.status = status;
  return e;
}

// ── Internal row shape (Drizzle returns decimals as strings) ──────────────────

interface ProductRow {
  id:          string;
  vendorId:    string;
  name:        string;
  description: string | null;
  category:    string;
  price:       string;
  comparePrice: string | null;
  stockQty:    number;
  sku:         string | null;
  r2ImageKeys: string[] | null;
  isActive:    boolean;
  isFeatured:  boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

function toProductSummary(row: ProductRow, vendorName: string): ProductSummary {
  return {
    id:           row.id,
    vendorId:     row.vendorId,
    vendorName,
    name:         row.name,
    description:  row.description,
    category:     row.category,
    price:        parseFloat(row.price),
    comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
    stockQty:     row.stockQty,
    imageKey:     row.r2ImageKeys?.[0] ?? null,
    isActive:     row.isActive,
    isFeatured:   row.isFeatured,
  };
}

// ── Helper: resolve userId → vendor row ──────────────────────────────────────

async function resolveVendor(userId: string): Promise<{ id: string; businessName: string }> {
  const rows = await db
    .select({ id: vendors.id, businessName: vendors.businessName })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('FORBIDDEN', 'Only vendors can perform this action', 403);
  }
  return rows[0]!;
}

// ── Helper: verify vendor owns product ──────────────────────────────────────

async function resolveVendorProduct(
  userId: string,
  productId: string,
): Promise<{ product: ProductRow; vendor: { id: string; businessName: string } }> {
  const vendor = await resolveVendor(userId);

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.vendorId, vendor.id)))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('FORBIDDEN', 'Product not found or you do not own it', 403);
  }

  return { product: rows[0] as ProductRow, vendor };
}

// ── 1) listProducts ───────────────────────────────────────────────────────────

export async function listProducts(query: ProductListQuery): Promise<{
  products: ProductSummary[];
  meta: { page: number; limit: number; total: number };
}> {
  const { page, limit, category, vendorId, featured, search, minPrice, maxPrice } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(products.isActive, true)];

  if (category) {
    conditions.push(eq(products.category, category));
  }
  if (vendorId) {
    conditions.push(eq(products.vendorId, vendorId));
  }
  if (featured !== undefined) {
    conditions.push(eq(products.isFeatured, featured));
  }
  if (search) {
    conditions.push(ilike(products.name, `%${search}%`));
  }
  if (minPrice !== undefined) {
    conditions.push(gte(products.price, String(minPrice)));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(products.price, String(maxPrice)));
  }

  const where = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    db
      .select({
        product:      products,
        vendorName:   vendors.businessName,
      })
      .from(products)
      .innerJoin(vendors, eq(products.vendorId, vendors.id))
      .where(where)
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    products: rows.map((r) => toProductSummary(r.product as ProductRow, r.vendorName)),
    meta:     { page, limit, total },
  };
}

// ── 2) getProduct ─────────────────────────────────────────────────────────────

export async function getProduct(productId: string): Promise<ProductSummary> {
  const rows = await db
    .select({
      product:    products,
      vendorName: vendors.businessName,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(eq(products.id, productId))
    .limit(1);

  if (rows.length === 0) {
    throw makeError('NOT_FOUND', 'Product not found', 404);
  }

  const { product, vendorName } = rows[0]!;
  return toProductSummary(product as ProductRow, vendorName);
}

// ── 3) createProduct ──────────────────────────────────────────────────────────

export async function createProduct(
  userId: string,
  input: CreateProductInput,
): Promise<ProductSummary> {
  const vendor = await resolveVendor(userId);

  const inserted = await db
    .insert(products)
    .values({
      vendorId:     vendor.id,
      name:         input.name,
      description:  input.description ?? null,
      category:     input.category,
      price:        String(input.price),
      comparePrice: input.comparePrice ? String(input.comparePrice) : null,
      stockQty:     input.stockQty,
      sku:          input.sku ?? null,
      r2ImageKeys:  [],
      isFeatured:   input.isFeatured ?? false,
      isActive:     true,
    })
    .returning();

  return toProductSummary(inserted[0] as ProductRow, vendor.businessName);
}

// ── 4) updateProduct ──────────────────────────────────────────────────────────

export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<ProductSummary> {
  const { product: existing, vendor } = await resolveVendorProduct(userId, productId);

  const updated = await db
    .update(products)
    .set({
      ...(input.name !== undefined        && { name:         input.name }),
      ...(input.description !== undefined && { description:  input.description }),
      ...(input.category !== undefined    && { category:     input.category }),
      ...(input.price !== undefined       && { price:        String(input.price) }),
      ...(input.comparePrice !== undefined && { comparePrice: input.comparePrice ? String(input.comparePrice) : null }),
      ...(input.stockQty !== undefined    && { stockQty:     input.stockQty }),
      ...(input.sku !== undefined         && { sku:          input.sku }),
      ...(input.isFeatured !== undefined  && { isFeatured:   input.isFeatured }),
      updatedAt: new Date(),
    })
    .where(eq(products.id, existing.id))
    .returning();

  return toProductSummary(updated[0] as ProductRow, vendor.businessName);
}

// ── 5) deleteProduct (soft delete) ───────────────────────────────────────────

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  await resolveVendorProduct(userId, productId);

  await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

// ── 6) updateStock ────────────────────────────────────────────────────────────

export async function updateStock(
  userId: string,
  productId: string,
  input: UpdateStockInput,
): Promise<ProductSummary> {
  const { product: existing, vendor } = await resolveVendorProduct(userId, productId);

  const updated = await db
    .update(products)
    .set({ stockQty: input.stockQty, updatedAt: new Date() })
    .where(eq(products.id, existing.id))
    .returning();

  return toProductSummary(updated[0] as ProductRow, vendor.businessName);
}

// ── 7) addProductImages ───────────────────────────────────────────────────────

export async function addProductImages(
  userId: string,
  productId: string,
  r2Keys: string[],
): Promise<ProductSummary> {
  const { product: existing, vendor } = await resolveVendorProduct(userId, productId);

  const merged = [...(existing.r2ImageKeys ?? []), ...r2Keys];

  const updated = await db
    .update(products)
    .set({ r2ImageKeys: merged, updatedAt: new Date() })
    .where(eq(products.id, existing.id))
    .returning();

  return toProductSummary(updated[0] as ProductRow, vendor.businessName);
}

// ── 8) getFeaturedProducts ────────────────────────────────────────────────────

export async function getFeaturedProducts(): Promise<ProductSummary[]> {
  const rows = await db
    .select({
      product:    products,
      vendorName: vendors.businessName,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.isFeatured, true), eq(products.isActive, true)))
    .limit(8);

  return rows.map((r) => toProductSummary(r.product as ProductRow, r.vendorName));
}

// ── 9) getVendorProducts ──────────────────────────────────────────────────────

export async function getVendorProducts(userId: string): Promise<ProductSummary[]> {
  const vendor = await resolveVendor(userId);

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.vendorId, vendor.id));

  return rows.map((r) => toProductSummary(r as ProductRow, vendor.businessName));
}
