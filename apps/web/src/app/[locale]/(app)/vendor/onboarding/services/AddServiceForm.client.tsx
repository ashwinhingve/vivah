'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { addServiceAction } from './actions';

const SERVICE_UNITS = [
  { value: 'per event', labelKey: 'vendorRole.onboarding.labels.serviceUnits.per_event' },
  { value: 'per day', labelKey: 'vendorRole.onboarding.labels.serviceUnits.per_day' },
  { value: 'per hour', labelKey: 'vendorRole.onboarding.labels.serviceUnits.per_hour' },
  { value: 'per plate', labelKey: 'vendorRole.onboarding.labels.serviceUnits.per_plate' },
  { value: 'per person', labelKey: 'vendorRole.onboarding.labels.serviceUnits.per_person' },
  { value: 'fixed', labelKey: 'vendorRole.onboarding.labels.serviceUnits.fixed' },
];

export function AddServiceForm({ vendorId }: { vendorId: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(addServiceAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset();
  }, [state]);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <input type="hidden" name="vendorId" value={vendorId} />
      <h3 className="font-heading text-base text-primary">{t('vendorRole.onboarding.addServiceForm.title')}</h3>

      <div>
        <label htmlFor="name" className={labelCls}>{t('vendorRole.onboarding.addServiceForm.nameLabel')}</label>
        <input id="name" name="name" required disabled={pending} className={inputCls} placeholder={t('vendorRole.onboarding.addServiceForm.namePlaceholder')} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="priceFrom" className={labelCls}>{t('vendorRole.onboarding.addServiceForm.priceFromLabel')}</label>
          <input id="priceFrom" name="priceFrom" type="number" min="1" required disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="priceTo" className={labelCls}>{t('vendorRole.onboarding.addServiceForm.priceToLabel')}</label>
          <input id="priceTo" name="priceTo" type="number" min="1" disabled={pending} className={inputCls} />
        </div>
        <div>
          <label htmlFor="unit" className={labelCls}>{t('vendorRole.onboarding.addServiceForm.unitLabel')}</label>
          <select id="unit" name="unit" required disabled={pending} defaultValue="per event" className={inputCls}>
            {SERVICE_UNITS.map((u) => <option key={u.value} value={u.value}>{t(u.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>{t('vendorRole.onboarding.addServiceForm.descriptionLabel')}</label>
        <textarea id="description" name="description" rows={2} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50" />
      </div>

      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/5 px-5 text-sm font-medium text-teal hover:bg-teal/10 disabled:opacity-50">
        <Plus className="h-4 w-4" /> {pending ? t('vendorRole.onboarding.addServiceForm.adding') : t('vendorRole.onboarding.addServiceForm.submit')}
      </button>
    </form>
  );
}
