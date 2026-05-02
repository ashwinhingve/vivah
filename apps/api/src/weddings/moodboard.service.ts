/**
 * Smart Shaadi — Wedding mood board
 *
 * Visual inspiration gallery. Stores R2 keys + tags + categories.
 */

import { eq, and, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingMoodBoardItems } from '@smartshaadi/db';
import type { MoodBoardItem } from '@smartshaadi/types';
import type {
  AddMoodBoardItemInput,
  UpdateMoodBoardItemInput,
} from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { getPhotoUrl } from '../storage/service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

async function toDto(r: typeof weddingMoodBoardItems.$inferSelect): Promise<MoodBoardItem> {
  return {
    id:        r.id,
    weddingId: r.weddingId,
    r2Key:     r.r2Key,
    url:       await getPhotoUrl(r.r2Key, 1800).catch(() => null),
    caption:   r.caption,
    category:  r.category,
    tags:      (r.tags ?? []) as string[],
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listItems(weddingId: string, userId: string, category?: string): Promise<MoodBoardItem[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const where = category
    ? and(eq(weddingMoodBoardItems.weddingId, weddingId), eq(weddingMoodBoardItems.category, category as 'OTHER'))
    : eq(weddingMoodBoardItems.weddingId, weddingId);
  const rows = await db.select().from(weddingMoodBoardItems).where(where).orderBy(asc(weddingMoodBoardItems.sortOrder));
  return Promise.all(rows.map(toDto));
}

export async function addItem(
  weddingId: string,
  userId: string,
  input: AddMoodBoardItemInput,
): Promise<MoodBoardItem> {
  await requireRole(weddingId, userId, 'EDITOR');
  const [row] = await db
    .insert(weddingMoodBoardItems)
    .values({
      weddingId,
      r2Key:     input.r2Key,
      caption:   input.caption ?? null,
      category:  input.category ?? 'OTHER',
      tags:      input.tags ?? [],
      sortOrder: input.sortOrder ?? 0,
      uploadedBy: userId,
    })
    .returning();
  if (!row) throw appErr('Add failed', 'MOODBOARD_CREATE_FAILED', 500);
  await logActivity(weddingId, userId, 'moodboard.add', 'moodboardItem', row.id);
  return toDto(row);
}

export async function updateItem(
  weddingId: string,
  userId: string,
  itemId: string,
  input: UpdateMoodBoardItemInput,
): Promise<MoodBoardItem> {
  await requireRole(weddingId, userId, 'EDITOR');
  const updates: Partial<typeof weddingMoodBoardItems.$inferInsert> = {};
  if (input.caption   !== undefined) updates.caption   = input.caption ?? null;
  if (input.category  !== undefined) updates.category  = input.category;
  if (input.tags      !== undefined) updates.tags      = input.tags;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.r2Key     !== undefined) updates.r2Key     = input.r2Key;

  const [row] = await db.update(weddingMoodBoardItems).set(updates)
    .where(and(eq(weddingMoodBoardItems.id, itemId), eq(weddingMoodBoardItems.weddingId, weddingId)))
    .returning();
  if (!row) throw appErr('Item not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'moodboard.update', 'moodboardItem', itemId);
  return toDto(row);
}

export async function deleteItem(
  weddingId: string,
  userId: string,
  itemId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db.delete(weddingMoodBoardItems)
    .where(and(eq(weddingMoodBoardItems.id, itemId), eq(weddingMoodBoardItems.weddingId, weddingId)))
    .returning({ id: weddingMoodBoardItems.id });
  if (deleted.length === 0) throw appErr('Item not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'moodboard.delete', 'moodboardItem', itemId);
}
