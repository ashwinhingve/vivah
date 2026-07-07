'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

type State = { error: string } | { ok: true } | undefined;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addBlockedDateAction(_prev: State, formData: FormData): Promise<State> {
  const date = ((formData.get('date') as string | null) ?? '').trim();
  const reason = ((formData.get('reason') as string | null) ?? '').trim();
  if (!DATE_RE.test(date)) return { error: 'Pick a valid date.' };

  const body: Record<string, unknown> = { date };
  if (reason) body['reason'] = reason;

  const r = await mutateApi('/api/v1/vendors/blocked-dates', { method: 'POST', body });
  if (!r.ok) return { error: r.error ?? 'Could not block that date.' };

  revalidatePath('/vendor/onboarding/availability');
  return { ok: true };
}

export async function removeBlockedDateAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await mutateApi(`/api/v1/vendors/blocked-dates/${id}`, { method: 'DELETE' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not remove that date.' };
  revalidatePath('/vendor/onboarding/availability');
  return { ok: true };
}
