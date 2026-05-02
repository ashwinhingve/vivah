'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export async function inviteMemberAction(weddingId: string, formData: FormData): Promise<void> {
  const email = trim(formData.get('email'));
  const role = trim(formData.get('role')) ?? 'VIEWER';
  if (!email) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/members/invites`, {
    method: 'POST',
    body: { email, role },
  });
  revalidatePath(`/weddings/${weddingId}/members`);
}

export async function updateRoleAction(weddingId: string, memberId: string, formData: FormData): Promise<void> {
  const role = trim(formData.get('role'));
  if (!role) return;
  await mutateApi(`/api/v1/weddings/${weddingId}/members/${memberId}`, {
    method: 'PUT',
    body: { role },
  });
  revalidatePath(`/weddings/${weddingId}/members`);
}

export async function removeMemberAction(weddingId: string, memberId: string): Promise<void> {
  await mutateApi(`/api/v1/weddings/${weddingId}/members/${memberId}`, { method: 'DELETE' });
  revalidatePath(`/weddings/${weddingId}/members`);
}
