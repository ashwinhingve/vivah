'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function dateTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  return new Date(`${date}T${time ?? '09:00'}:00`).toISOString();
}

export async function createEventAction(weddingId: string, formData: FormData): Promise<void> {
  const date  = trim(formData.get('date'));
  const start = trim(formData.get('startTime'));
  const end   = trim(formData.get('endTime'));
  const title = trim(formData.get('title'));
  if (!title || !date || !start) return;

  await mutateApi(`/api/v1/weddings/${weddingId}/timeline`, {
    method: 'POST',
    body: {
      title,
      startTime:   dateTime(date, start),
      endTime:     end ? dateTime(date, end) : undefined,
      location:    trim(formData.get('location')),
      description: trim(formData.get('description')),
      ceremonyId:  trim(formData.get('ceremonyId')),
    },
  });
  revalidatePath(`/weddings/${weddingId}/timeline`);
}

export async function deleteEventAction(weddingId: string, eventId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/timeline/${eventId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/timeline`);
}

export async function autoGenerateAction(weddingId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/timeline/auto-generate`, { method: 'POST' });
  revalidatePath(`/weddings/${weddingId}/timeline`);
}
