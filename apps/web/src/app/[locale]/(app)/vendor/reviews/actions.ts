'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export async function replyToReviewAction(
  reviewId: string,
  reply: string,
): Promise<{ ok: boolean; error?: string }> {
  const text = reply.trim();
  if (!text) return { ok: false, error: 'Write a reply first.' };
  if (text.length > 2000) return { ok: false, error: 'Reply is too long (max 2000 characters).' };

  const r = await mutateApi(`/api/v1/vendors/reviews/${reviewId}/reply`, {
    method: 'POST',
    body: { reply: text },
  });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not post your reply.' };

  revalidatePath('/vendor/reviews');
  return { ok: true };
}
