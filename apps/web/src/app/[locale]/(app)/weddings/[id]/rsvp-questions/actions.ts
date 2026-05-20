'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';
import type { RsvpCustomQuestion } from '@smartshaadi/types';

interface Result<T = unknown> { ok: boolean; data?: T; error?: string; }

export async function addQuestionAction(
  weddingId: string,
  payload: Record<string, unknown>,
): Promise<Result<RsvpCustomQuestion>> {
  const r = await mutateApi<RsvpCustomQuestion>(`/api/v1/weddings/${weddingId}/rsvp-questions`, { method: 'POST', body: payload });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/rsvp-questions`);
  return r;
}

export async function updateQuestionAction(
  weddingId: string,
  qId: string,
  payload: Record<string, unknown>,
): Promise<Result<RsvpCustomQuestion>> {
  const r = await mutateApi<RsvpCustomQuestion>(`/api/v1/weddings/${weddingId}/rsvp-questions/${qId}`, { method: 'PUT', body: payload });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/rsvp-questions`);
  return r;
}

export async function deleteQuestionAction(weddingId: string, qId: string): Promise<Result> {
  const r = await mutateApi(`/api/v1/weddings/${weddingId}/rsvp-questions/${qId}`, { method: 'DELETE' });
  if (r.ok) revalidatePath(`/weddings/${weddingId}/rsvp-questions`);
  return r;
}
