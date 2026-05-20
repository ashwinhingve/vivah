'use server';

import { revalidatePath } from 'next/cache';
import { mutateApi } from '@/lib/wedding-api';

function trim(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export async function saveWebsiteAction(weddingId: string, formData: FormData): Promise<void> {
  const slug = trim(formData.get('slug'));
  const title = trim(formData.get('title'));
  if (!slug || !title) return;

  const themePrimary = trim(formData.get('themePrimary')) ?? '#7B2D42';
  const themeAccent  = trim(formData.get('themeAccent'))  ?? '#C5A47E';
  const themeFont    = trim(formData.get('themeFont'))    ?? 'Playfair Display';

  await mutateApi(`/api/v1/weddings/${weddingId}/website`, {
    method: 'PUT',
    body: {
      slug,
      title,
      story:           trim(formData.get('story')),
      heroImageKey:    trim(formData.get('heroImageKey')),
      theme:           { primary: themePrimary, accent: themeAccent, font: themeFont },
      isPublic:        formData.get('isPublic') === 'on',
      rsvpEnabled:     formData.get('rsvpEnabled') === 'on',
      registryEnabled: formData.get('registryEnabled') === 'on',
      password:        trim(formData.get('password')),
    },
  });
  revalidatePath(`/weddings/${weddingId}/website`);
}
