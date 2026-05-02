'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export async function createTableAction(weddingId: string, formData: FormData): Promise<void> {
  const name = trim(formData.get('name'));
  if (!name) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/seating/tables`, {
    method: 'POST',
    body: {
      name,
      capacity: Number(formData.get('capacity') ?? 8),
      shape:    trim(formData.get('shape')) ?? 'ROUND',
    },
  });
  revalidatePath(`/weddings/${weddingId}/seating`);
}

export async function deleteTableAction(weddingId: string, tableId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/seating/tables/${tableId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/seating`);
}

export async function assignSeatAction(weddingId: string, tableId: string, formData: FormData): Promise<void> {
  const guestId = trim(formData.get('guestId'));
  if (!guestId) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/seating/tables/${tableId}/assign`, {
    method: 'POST',
    body: { guestId },
  });
  revalidatePath(`/weddings/${weddingId}/seating`);
}

export async function unassignSeatAction(weddingId: string, tableId: string, guestId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/seating/tables/${tableId}/assign/${guestId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/seating`);
}

export async function autoAssignAction(weddingId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/seating/auto-assign`, { method: 'POST', body: {} });
  revalidatePath(`/weddings/${weddingId}/seating`);
}
