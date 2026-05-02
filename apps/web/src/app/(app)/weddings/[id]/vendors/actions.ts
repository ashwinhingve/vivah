'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export async function assignVendorAction(weddingId: string, formData: FormData): Promise<void> {
  const vendorId = trim(formData.get('vendorId'));
  const role = trim(formData.get('role'));
  if (!vendorId || !role) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/vendors`, {
    method: 'POST',
    body: {
      vendorId, role,
      ceremonyId: trim(formData.get('ceremonyId')),
      status: trim(formData.get('status')) ?? 'SHORTLISTED',
      notes: trim(formData.get('notes')),
    },
  });
  revalidatePath(`/weddings/${weddingId}/vendors`);
}

export async function updateAssignmentAction(weddingId: string, assignmentId: string, formData: FormData): Promise<void> {
  const status = trim(formData.get('status'));
  if (!status) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/vendors/${assignmentId}`, {
    method: 'PUT',
    body: { status },
  });
  revalidatePath(`/weddings/${weddingId}/vendors`);
}

export async function removeAssignmentAction(weddingId: string, assignmentId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/vendors/${assignmentId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/vendors`);
}
