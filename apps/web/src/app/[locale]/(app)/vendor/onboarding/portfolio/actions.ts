'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/redirect';
import { mutateApi } from '@/lib/wedding-api';
import { EVENT_TYPE_VALUES, type EventTypeValue } from '@smartshaadi/schemas';

type State = { error: string } | undefined;

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPE_VALUES);

function toList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Saves portfolio basics + the event types this vendor serves, then advances. */
export async function savePortfolioAction(_prev: State, formData: FormData): Promise<State> {
  const vendorId = ((formData.get('vendorId') as string | null) ?? '').trim();
  if (!vendorId) return { error: 'Save your business details first.' };

  const about = ((formData.get('about') as string | null) ?? '').trim();
  const awards = toList((formData.get('awards') as string | null) ?? '');
  const certifications = toList((formData.get('certifications') as string | null) ?? '');

  const basics: Record<string, unknown> = {};
  if (about) basics['about'] = about;
  if (awards.length) basics['awards'] = awards;
  if (certifications.length) basics['certifications'] = certifications;

  if (Object.keys(basics).length > 0) {
    const r = await mutateApi(`/api/v1/vendors/${vendorId}/portfolio`, { method: 'PUT', body: basics });
    if (!r.ok) return { error: r.error ?? 'Could not save portfolio details.' };
  }

  const eventTypes = formData
    .getAll('eventTypes')
    .map((v) => String(v))
    .filter((v): v is EventTypeValue => EVENT_TYPE_SET.has(v));

  const et = await mutateApi(`/api/v1/vendors/${vendorId}/event-types`, {
    method: 'PUT',
    body: { eventTypes },
  });
  if (!et.ok) return { error: et.error ?? 'Could not save event types.' };

  revalidatePath('/vendor/onboarding/portfolio');
  return await redirect('/vendor/onboarding/availability');
}
