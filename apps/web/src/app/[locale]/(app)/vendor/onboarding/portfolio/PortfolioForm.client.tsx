'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { savePortfolioAction } from './actions';
import { EVENT_TYPE_VALUES, type EventTypeValue } from '@smartshaadi/schemas';

const EVENT_TYPE_LABELS = {
  WEDDING: 'vendorRole.onboarding.labels.eventTypes.WEDDING',
  CORPORATE: 'vendorRole.onboarding.labels.eventTypes.CORPORATE',
  FESTIVAL: 'vendorRole.onboarding.labels.eventTypes.FESTIVAL',
  COMMUNITY_EVENT: 'vendorRole.onboarding.labels.eventTypes.COMMUNITY_EVENT',
  COMMUNITY: 'vendorRole.onboarding.labels.eventTypes.COMMUNITY',
  GOVERNMENT: 'vendorRole.onboarding.labels.eventTypes.GOVERNMENT',
  SCHOOL: 'vendorRole.onboarding.labels.eventTypes.SCHOOL',
  OTHER: 'vendorRole.onboarding.labels.eventTypes.OTHER',
  HALDI: 'vendorRole.onboarding.labels.eventTypes.HALDI',
  MEHNDI: 'vendorRole.onboarding.labels.eventTypes.MEHNDI',
  SANGEET: 'vendorRole.onboarding.labels.eventTypes.SANGEET',
  ENGAGEMENT: 'vendorRole.onboarding.labels.eventTypes.ENGAGEMENT',
  RECEPTION: 'vendorRole.onboarding.labels.eventTypes.RECEPTION',
} as const;

interface Props {
  vendorId: string;
  about: string;
  awards: string[];
  certifications: string[];
  selectedEventTypes: EventTypeValue[];
}

export function PortfolioForm({ vendorId, about, awards, certifications, selectedEventTypes }: Props) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(savePortfolioAction, undefined);
  const selected = new Set<string>(selectedEventTypes);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';
  const labelCls = 'mb-1 block text-sm font-medium text-primary';

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <input type="hidden" name="vendorId" value={vendorId} />

      <div>
        <label htmlFor="about" className={labelCls}>{t('vendorRole.onboarding.portfolioForm.aboutLabel')}</label>
        <textarea id="about" name="about" rows={4} defaultValue={about} disabled={pending}
          className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50"
          placeholder={t('vendorRole.onboarding.portfolioForm.aboutPlaceholder')} />
      </div>

      <div>
        <label htmlFor="awards" className={labelCls}>{t('vendorRole.onboarding.portfolioForm.awardsLabel')}</label>
        <input id="awards" name="awards" defaultValue={awards.join(', ')} disabled={pending} className={inputCls}
          placeholder={t('vendorRole.onboarding.portfolioForm.awardsPlaceholder')} />
      </div>

      <div>
        <label htmlFor="certifications" className={labelCls}>{t('vendorRole.onboarding.portfolioForm.certificationsLabel')}</label>
        <input id="certifications" name="certifications" defaultValue={certifications.join(', ')} disabled={pending} className={inputCls}
          placeholder={t('vendorRole.onboarding.portfolioForm.certificationsPlaceholder')} />
      </div>

      <fieldset>
        <legend className={labelCls}>{t('vendorRole.onboarding.portfolioForm.eventTypesLabel')}</legend>
        <p className="mb-2 text-xs text-muted-foreground">
          {t('vendorRole.onboarding.portfolioForm.eventTypesHint')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EVENT_TYPE_VALUES.map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-gold/40"
            >
              <input type="checkbox" name="eventTypes" value={v} defaultChecked={selected.has(v)} disabled={pending}
                className="h-4 w-4 rounded border-border accent-teal" />
              <span className="text-primary">{t(EVENT_TYPE_LABELS[v as keyof typeof EVENT_TYPE_LABELS])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
        {pending ? t('vendorRole.onboarding.portfolioForm.saving') : t('vendorRole.onboarding.portfolioForm.submit')} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
