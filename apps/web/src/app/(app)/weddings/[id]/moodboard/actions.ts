'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export async function addMoodBoardItemAction(
  weddingId: string,
  data: { r2Key: string; caption?: string; category?: string; tags?: string[] },
): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/moodboard`, { method: 'POST', body: data });
  revalidatePath(`/weddings/${weddingId}/moodboard`);
}

export async function deleteMoodBoardItemAction(weddingId: string, itemId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/moodboard/${itemId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/moodboard`);
}
