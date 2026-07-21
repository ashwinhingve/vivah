'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { saveBusinessAction } from './actions';
import type { VendorProfile } from '@smartshaadi/types';

const CATEGORIES = [
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE',
  'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING', 'SECURITY',
  'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING', 'RENTAL', 'OTHER',
] as const;

const CATEGORY_LABELS = {
  PHOTOGRAPHY: 'vendorRole.onboarding.labels.categories.PHOTOGRAPHY',
  VIDEOGRAPHY: 'vendorRole.onboarding.labels.categories.VIDEOGRAPHY',
  CATERING: 'vendorRole.onboarding.labels.categories.CATERING',
  DECORATION: 'vendorRole.onboarding.labels.categories.DECORATION',
  VENUE: 'vendorRole.onboarding.labels.categories.VENUE',
  MAKEUP: 'vendorRole.onboarding.labels.categories.MAKEUP',
  JEWELLERY: 'vendorRole.onboarding.labels.categories.JEWELLERY',
  CLOTHING: 'vendorRole.onboarding.labels.categories.CLOTHING',
  MUSIC: 'vendorRole.onboarding.labels.categories.MUSIC',
  LIGHTING: 'vendorRole.onboarding.labels.categories.LIGHTING',
  SECURITY: 'vendorRole.onboarding.labels.categories.SECURITY',
  TRANSPORT: 'vendorRole.onboarding.labels.categories.TRANSPORT',
  PRIEST: 'vendorRole.onboarding.labels.categories.PRIEST',
  SOUND: 'vendorRole.onboarding.labels.categories.SOUND',
  EVENT_HOSTING: 'vendorRole.onboarding.labels.categories.EVENT_HOSTING',
  RENTAL: 'vendorRole.onboarding.labels.categories.RENTAL',
  OTHER: 'vendorRole.onboarding.labels.categories.OTHER',
} as const;

export function BusinessForm({ vendor }: { vendor: VendorProfile | null }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(saveBusinessAction, undefined);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {vendor?.id && <input type="hidden" name="vendorId" value={vendor.id} />}

      <div>
        <label htmlFor="businessName" className={labelCls}>{t('vendorRole.onboarding.businessForm.nameLabel')}</label>
        <input id="businessName" name="businessName" required defaultValue={vendor?.businessName ?? ''} disabled={pending} className={inputCls} />
      </div>

      <div>
        <label htmlFor="category" className={labelCls}>{t('vendorRole.onboarding.businessForm.categoryLabel')}</label>
        <select id="category" name="category" required defaultValue={vendor?.category ?? ''} disabled={pending} className={inputCls}>
          <option value="" disabled>{t('vendorRole.onboarding.businessForm.categoryPlaceholder')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS])}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={labelCls}>{t('vendorRole.onboarding.businessForm.cityLabel')}</label>
          <input id="city" name="city" required defaultValue={vendor?.city ?? ''} disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="state" className={labelCls}>{t('vendorRole.onboarding.businessForm.stateLabel')}</label>
          <input id="state" name="state" required defaultValue={vendor?.state ?? ''} disabled={pending} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelCls}>{t('vendorRole.onboarding.businessForm.phoneLabel')}</label>
          <input id="phone" name="phone" type="tel" defaultValue={vendor?.phone ?? ''} disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="email" className={labelCls}>{t('vendorRole.onboarding.businessForm.emailLabel')}</label>
          <input id="email" name="email" type="email" defaultValue={vendor?.email ?? ''} disabled={pending} className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="tagline" className={labelCls}>{t('vendorRole.onboarding.businessForm.taglineLabel')}</label>
        <input id="tagline" name="tagline" maxLength={255} defaultValue={vendor?.tagline ?? ''} disabled={pending} className={inputCls} placeholder={t('vendorRole.onboarding.businessForm.taglinePlaceholder')} />
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>{t('vendorRole.onboarding.businessForm.descriptionLabel')}</label>
        <textarea id="description" name="description" rows={4} defaultValue={vendor?.description ?? ''} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? t('vendorRole.onboarding.businessForm.saving') : t('vendorRole.onboarding.businessForm.submit')} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
