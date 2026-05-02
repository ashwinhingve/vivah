/**
 * Smart Shaadi — Wedding documents
 *
 * Stores R2 keys for contracts, receipts, IDs, etc. Returns presigned GET URLs
 * on read.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { weddingDocuments } from '@smartshaadi/db';
import type { WeddingDocument } from '@smartshaadi/types';
import type { AddDocumentInput } from '@smartshaadi/schemas';
import { requireRole } from './access.js';
import { logActivity } from './activity.service.js';
import { getPhotoUrl } from '../storage/service.js';

interface AppError extends Error { code: string; status: number; }
function appErr(msg: string, code: string, status: number): AppError {
  return Object.assign(new Error(msg), { code, status });
}

export async function listDocuments(weddingId: string, userId: string): Promise<WeddingDocument[]> {
  await requireRole(weddingId, userId, 'VIEWER');
  const rows = await db
    .select()
    .from(weddingDocuments)
    .where(eq(weddingDocuments.weddingId, weddingId))
    .orderBy(desc(weddingDocuments.createdAt));

  const out: WeddingDocument[] = [];
  for (const r of rows) {
    out.push({
      id:         r.id,
      weddingId:  r.weddingId,
      type:       r.type,
      label:      r.label,
      r2Key:      r.r2Key,
      url:        await getPhotoUrl(r.r2Key, 1800).catch(() => null),
      fileSize:   r.fileSize,
      mimeType:   r.mimeType,
      vendorId:   r.vendorId,
      expenseId:  r.expenseId,
      uploadedBy: r.uploadedBy,
      createdAt:  r.createdAt.toISOString(),
    });
  }
  return out;
}

export async function addDocument(
  weddingId: string,
  userId: string,
  input: AddDocumentInput,
): Promise<WeddingDocument> {
  await requireRole(weddingId, userId, 'EDITOR');

  const [row] = await db
    .insert(weddingDocuments)
    .values({
      weddingId,
      type:       input.type,
      label:      input.label,
      r2Key:      input.r2Key,
      fileSize:   input.fileSize ?? null,
      mimeType:   input.mimeType ?? null,
      vendorId:   input.vendorId ?? null,
      expenseId:  input.expenseId ?? null,
      uploadedBy: userId,
    })
    .returning();
  if (!row) throw appErr('Add document failed', 'DOC_CREATE_FAILED', 500);

  await logActivity(weddingId, userId, 'document.add', 'document', row.id, { label: input.label });

  return {
    id:         row.id,
    weddingId:  row.weddingId,
    type:       row.type,
    label:      row.label,
    r2Key:      row.r2Key,
    url:        await getPhotoUrl(row.r2Key, 1800).catch(() => null),
    fileSize:   row.fileSize,
    mimeType:   row.mimeType,
    vendorId:   row.vendorId,
    expenseId:  row.expenseId,
    uploadedBy: row.uploadedBy,
    createdAt:  row.createdAt.toISOString(),
  };
}

export async function deleteDocument(
  weddingId: string,
  userId: string,
  documentId: string,
): Promise<void> {
  await requireRole(weddingId, userId, 'EDITOR');
  const deleted = await db
    .delete(weddingDocuments)
    .where(and(eq(weddingDocuments.id, documentId), eq(weddingDocuments.weddingId, weddingId)))
    .returning({ id: weddingDocuments.id });
  if (deleted.length === 0) throw appErr('Document not found', 'NOT_FOUND', 404);
  await logActivity(weddingId, userId, 'document.delete', 'document', documentId);
}
