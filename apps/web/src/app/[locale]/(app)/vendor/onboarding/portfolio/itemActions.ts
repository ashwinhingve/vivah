'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

export interface PortfolioItemInput {
  title?: string;
  description?: string;
  eventType?: string;
  eventDate?: string;
  photoKeys?: string[];
}

type Result = { ok: true } | { ok: false; error: string };

function validate(input: PortfolioItemInput): string | null {
  if (input.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)) {
    return 'Enter a valid event date.';
  }
  return null;
}

export async function addPortfolioItemAction(vendorId: string, input: PortfolioItemInput): Promise<Result> {
  const v = validate(input);
  if (v) return { ok: false, error: v };
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/portfolio/items`, { method: 'POST', body: input });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not add the portfolio item.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}

export async function updatePortfolioItemAction(vendorId: string, idx: number, input: PortfolioItemInput): Promise<Result> {
  const v = validate(input);
  if (v) return { ok: false, error: v };
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/portfolio/items/${idx}`, { method: 'PUT', body: input });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not update the portfolio item.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}

export async function removePortfolioItemAction(vendorId: string, idx: number): Promise<Result> {
  const r = await mutateApi(`/api/v1/vendors/${vendorId}/portfolio/items/${idx}`, { method: 'DELETE' });
  if (!r.ok) return { ok: false, error: r.error ?? 'Could not remove the portfolio item.' };
  revalidatePath('/vendor/onboarding/portfolio');
  return { ok: true };
}
