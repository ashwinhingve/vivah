/**
 * Smart Shaadi — Gift registry
 *
 * Couple lists items they want; guests can claim items from public website.
 */

import { eq, and, asc, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { giftRegistryItems } from '@smartshaadi/db';
import type { RegistryItem } from '@smartshaadi/types';
import type {
  CreateRegistryItemInput,
  UpdateRegistryItemInput,
  ClaimRegistryItemInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { getPhotoUrl } from '../storage/service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function toDto(r: typeof giftRegistryItems.$inferSelect): Promise<RegistryItem> {
  return {
    id:            r.id,
    weddingId:     r.weddingId,
    label:         r.label,
    description:   r.description,
    price:         r.price ? Number(r.price) : null,
    currency:      r.currency,
    imageR2Key:    r.imageR2Key,
    imageUrl:      r.imageR2Key ? await getPhotoUrl(r.imageR2Key, 1800).catch(() => null) : null,
    externalUrl:   r.externalUrl,
    status:        r.status,
    claimedByName: r.claimedByName,
    claimedAt:     r.claimedAt ? r.claimedAt.toISOString() : null,
    sortOrder:     r.sortOrder,
  };
}

export async function listItems(weddingId: string, userId: string): Promise<RegistryItem[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db.select().from(giftRegistryItems)
    .where(eq(giftRegistryItems.weddingId, weddingId))
    .orderBy(asc(giftRegistryItems.sortOrder));
  return Promise.all(rows.map(toDto));
}

export async function createItem(
  weddingId: string,
  userId: string,
  input: CreateRegistryItemInput,
): Promise<RegistryItem> {
  await requireRole(weddingId, userId, 'EDITOR');
  const [row] = await db.insert(giftRegistryItems).values({
    weddingId,
    label:       input.label,
    description: input.description ?? null,
    price:       input.price != null ? String(input.price) : null,
    imageR2Key:  input.imageR2Key ?? null,
    externalUrl: input.externalUrl ?? null,
    sortOrder:   input.sortOrder ?? 0,
  }).returning();
  if (!row) throw appErr('Create failed', 'REGISTRY_CREATE_FAILED', 500);
  await logActivity(weddingId, userId, 'registry.create', 'registryItem', row.id, { label: input.label });
  return toDto(row);
}

export async function updateItem(
  weddingId: string,
  userId: string,
  itemId: string,
  input: UpdateRegistryItemInput,
): Promise<RegistryItem> {
  await requireRole(weddingId, userId, 'EDITOR');
  const updates: Partial<typeof giftRegistryItems.$inferInsert> = {};
  if (input.label       !== undefined) updates.label       = input.label;
  if (input.description !== undefined) updates.description = input.description ?? null;
  if (input.price       !== undefined) updates.price       = input.price != null ? String(input.price) : null;
  if (input.imageR2Key  !== undefined) updates.imageR2Key  = input.imageR2Key ?? null;
  if (input.externalUrl !== undefined) updates.externalUrl = input.externalUrl ?? null;
  if (input.sortOrder   !== undefined) updates.sortOrder   = input.sortOrder;

  const [row] = await db.update(giftRegistryItems).set(updates)
    .where(and(eq(giftRegistryItems.id, itemId), eq(giftRegistryItems.weddingId, weddingId)))
    .returning();
  if (!row) throw appErr('Item not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'registry.update', 'registryItem', itemId);
  return toDto(row);
}

export async function deleteItem(
  weddingId: string,
  userId: string,
  itemId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db.delete(giftRegistryItems)
    .where(and(eq(giftRegistryItems.id, itemId), eq(giftRegistryItems.weddingId, weddingId)))
    .returning({ id: giftRegistryItems.id });
  if (deleted.length === 0) throw appErr('Item not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'registry.delete', 'registryItem', itemId);
}

// Public claim — no auth, claims an AVAILABLE item only.
export async function claimItemPublic(
  itemId: string,
  input: ClaimRegistryItemInput,
): Promise<RegistryItem> {
  const updated = await db.update(giftRegistryItems)
    .set({
      status:        'CLAIMED',
      claimedByName: input.claimerName,
      claimedAt:     new Date(),
    })
    .where(and(eq(giftRegistryItems.id, itemId), eq(giftRegistryItems.status, 'AVAILABLE'), isNull(giftRegistryItems.claimedAt)))
    .returning();
  const row = updated[0];
  if (!row) throw appErr('Item not available', 'NOT_AVAILABLE', 409);
  await logActivity(row.weddingId, null, 'registry.claim', 'registryItem', row.id, { claimerName: input.claimerName });
  return toDto(row);
}
