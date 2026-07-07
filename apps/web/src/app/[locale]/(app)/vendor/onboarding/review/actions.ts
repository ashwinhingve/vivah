'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export async function submitForReviewAction(): Promise<{ ok: boolean; error?: string }> {
  const r = await mutateApi('/api/v1/vendors/me/submit', { method: 'POST' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not submit for review.' };
  revalidatePath('/vendor/onboarding/review');
  revalidatePath('/vendor-dashboard');
  return { ok: true };
}
