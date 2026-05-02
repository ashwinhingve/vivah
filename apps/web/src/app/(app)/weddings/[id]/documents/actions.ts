'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export async function addDocumentAction(
  weddingId: string,
  data: { r2Key: string; label: string; type: string; fileSize?: number; mimeType?: string },
): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/documents`, { method: 'POST', body: data });
  revalidatePath(`/weddings/${weddingId}/documents`);
}

export async function deleteDocumentAction(weddingId: string, documentId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/documents/${documentId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/documents`);
}
