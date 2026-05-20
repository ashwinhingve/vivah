'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';
import type { FamilyMember, FamilyVerification } from '@smartshaadi/types';

interface Result<T = unknown> { ok: boolean; data?: T; error?: string; }

export async function updateFamilySectionAction(payload: Record<string, unknown>): Promise<Result> {
  const r = await mutateApi(`/api/v1/profiles/me/content/family`, { method: 'PUT', body: payload });
  if (r.ok) {
    revalidatePath('/family');
    revalidatePath('/dashboard');
  }
  return r;
}

export async function addFamilyMemberAction(payload: Record<string, unknown>): Promise<Result<FamilyMember>> {
  const r = await mutateApi<FamilyMember>(`/api/v1/profiles/me/family/members`, { method: 'POST', body: payload });
  if (r.ok) revalidatePath('/family');
  return r;
}

export async function removeFamilyMemberAction(memberId: string): Promise<Result> {
  const r = await mutateApi(`/api/v1/profiles/me/family/members/${memberId}`, { method: 'DELETE' });
  if (r.ok) revalidatePath('/family');
  return r;
}

export async function requestFamilyVerificationAction(): Promise<Result<FamilyVerification>> {
  const r = await mutateApi<FamilyVerification>(`/api/v1/profiles/me/family/verification/request`, { method: 'POST' });
  if (r.ok) revalidatePath('/family');
  return r;
}

export async function recomputeFamilyScoreAction(): Promise<Result<{ familyInclinationScore: number }>> {
  const r = await mutateApi<{ familyInclinationScore: number }>(`/api/v1/profiles/me/family/recompute-score`, { method: 'POST' });
  if (r.ok) revalidatePath('/family');
  return r;
}
