'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function num(v: FormDataEntryValue | null): number | undefined {
  const s = trim(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export async function createRegistryItemAction(weddingId: string, formData: FormData): Promise<void> {
  const label = trim(formData.get('label'));
  if (!label) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/registry`, {
    method: 'POST',
    body: {
      label,
      description: trim(formData.get('description')),
      price:       num(formData.get('price')),
      externalUrl: trim(formData.get('externalUrl')),
    },
  });
  revalidatePath(`/weddings/${weddingId}/registry`);
}

export async function deleteRegistryItemAction(weddingId: string, itemId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/registry/${itemId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/registry`);
}
