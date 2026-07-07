'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

type State = { error: string } | { ok: true } | undefined;

/** Adds one service to the vendor. Stays on the step so multiple can be added. */
export async function addServiceAction(_prev: State, formData: FormData): Promise<State> {
  const vendorId = ((formData.get('vendorId') as string | null) ?? '').trim();
  const name = ((formData.get('name') as string | null) ?? '').trim();
  const unit = ((formData.get('unit') as string | null) ?? '').trim();
  const priceFromRaw = ((formData.get('priceFrom') as string | null) ?? '').trim();
  const priceToRaw = ((formData.get('priceTo') as string | null) ?? '').trim();
  const description = ((formData.get('description') as string | null) ?? '').trim();

  if (!vendorId) return { error: 'Save your business details first.' };
  if (!name || !unit || !priceFromRaw) {
    return { error: 'Service name, starting price and unit are required.' };
  }

  const priceFrom = Number(priceFromRaw);
  if (!Number.isFinite(priceFrom) || priceFrom <= 0) {
    return { error: 'Starting price must be a positive number.' };
  }

  const body: Record<string, unknown> = { name, unit, priceFrom };
  if (priceToRaw) {
    const priceTo = Number(priceToRaw);
    if (!Number.isFinite(priceTo) || priceTo <= 0) return { error: 'Up-to price must be a positive number.' };
    body['priceTo'] = priceTo;
  }
  if (description) body['description'] = description;

  const r = await mutateApi(`/api/v1/vendors/${vendorId}/services`, { method: 'POST', body });
  if (!r.ok) return { error: r.error ?? 'Could not add the service.' };

  revalidatePath('/vendor/onboarding/services');
  return { ok: true };
}
