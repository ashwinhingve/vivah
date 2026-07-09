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

// ── Parent Mode — guardian co-pilot (Server Actions per CLAUDE.md rule 3) ────

export type ParentLinkRelationship = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SIBLING';
export type ParentLinkPermission   = 'VIEW_ONLY' | 'EDIT_PROFILE' | 'DRAFT_ACTIONS' | 'FULL_PROXY';

export interface CreateFamilyLinkInput {
  childUserId: string;
  relationship: ParentLinkRelationship;
  requestedPermissions?: ParentLinkPermission;
}

/** Initiates a parent-child link request — the missing caller for createLink(). */
export async function createFamilyLinkAction(input: CreateFamilyLinkInput): Promise<Result<{ id: string }>> {
  const r = await mutateApi<{ id: string }>(`/api/v1/family-mode/parent/links`, {
    method: 'POST',
    body: {
      child_user_id: input.childUserId,
      relationship: input.relationship,
      ...(input.requestedPermissions ? { requested_permissions: input.requestedPermissions } : {}),
    },
  });
  if (r.ok) {
    revalidatePath('/family');
    revalidatePath('/family/parent-mode');
  }
  return r;
}

export interface DraftFamilyInterestInput {
  childUserId: string;
  targetProfileId: string;
  message?: string;
}

/** Drafts a SEND_INTEREST action for the assisted seeker to approve or reject. */
export async function draftFamilyInterestAction(input: DraftFamilyInterestInput): Promise<Result<{ id: string }>> {
  const payload: Record<string, unknown> = { targetProfileId: input.targetProfileId };
  if (input.message) payload['message'] = input.message;

  const r = await mutateApi<{ id: string }>(`/api/v1/family-mode/parent/actions`, {
    method: 'POST',
    body: { child_user_id: input.childUserId, action_type: 'SEND_INTEREST', payload },
  });
  if (r.ok) {
    revalidatePath(`/family/browse/${input.childUserId}`);
    revalidatePath(`/family/parent-mode/${input.childUserId}`);
    revalidatePath('/family/parent-mode');
    revalidatePath('/family');
  }
  return r;
}
