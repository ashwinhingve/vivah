'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/redirect';
import { mutateApi } from '@/lib/wedding-api';
import type { VendorProfile } from '@smartshaadi/types';

type Result = { error: string } | undefined;

/**
 * Create-or-update in one step. A hidden `vendorId` field (populated by the
 * page from GET /vendors/me) tells us whether to PATCH an existing vendor or
 * POST a new one first — a user may only have one vendor row (unique
 * vendors.userId), so we only ever create when the field is absent.
 */
export async function saveBusinessAction(_prev: Result, formData: FormData): Promise<Result> {
  const vendorId = ((formData.get('vendorId') as string | null) ?? '').trim();
  const businessName = ((formData.get('businessName') as string | null) ?? '').trim();
  const category = (formData.get('category') as string | null) ?? '';
  const city = ((formData.get('city') as string | null) ?? '').trim();
  const state = ((formData.get('state') as string | null) ?? '').trim();
  const phone = ((formData.get('phone') as string | null) ?? '').trim();
  const email = ((formData.get('email') as string | null) ?? '').trim();
  const tagline = ((formData.get('tagline') as string | null) ?? '').trim();
  const description = ((formData.get('description') as string | null) ?? '').trim();

  if (!businessName || !category || !city || !state) {
    return { error: 'Business name, category, city and state are required.' };
  }

  let id = vendorId;
  if (!id) {
    const created = await mutateApi<VendorProfile>('/api/v1/vendors', {
      method: 'POST',
      body: { businessName, category, city, state },
    });
    if (!created.ok || !created.data) {
      return { error: created.error ?? 'Could not create your vendor profile.' };
    }
    id = created.data.id;
  }

  const patch: Record<string, unknown> = { businessName, category, city, state };
  if (phone)       patch['phone'] = phone;
  if (email)       patch['email'] = email;
  if (tagline)      patch['tagline'] = tagline;
  if (description)  patch['description'] = description;

  const updated = await mutateApi(`/api/v1/vendors/${id}`, { method: 'PATCH', body: patch });
  if (!updated.ok) return { error: updated.error ?? 'Could not save business details.' };

  revalidatePath('/vendor/onboarding');
  return await redirect('/vendor/onboarding/services');
}
