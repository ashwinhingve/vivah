'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarPlus, X } from 'lucide-react';
import { addBlockedDateAction, removeBlockedDateAction } from './actions';

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

export function AvailabilityManager({ initial }: { initial: BlockedDate[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(addBlockedDateAction, undefined);
  const [removing, startRemove] = useTransition();
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (state && 'ok' in state) formRef.current?.reset();
  }, [state]);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none disabled:opacity-50';

  const localeMap = locale === 'hi' ? 'hi-IN' : 'en-IN';

  return (
    <div className="space-y-5">
      <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
        <h3 className="font-heading text-base text-primary">{t('vendorRole.onboarding.availabilityManager.blockDateTitle')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="mb-1 block text-sm font-medium text-primary">{t('vendorRole.onboarding.availabilityManager.dateLabel')}</label>
            <input id="date" name="date" type="date" required disabled={pending} className={inputCls} />
          </div>
          <div>
            <label htmlFor="reason" className="mb-1 block text-sm font-medium text-primary">{t('vendorRole.onboarding.availabilityManager.reasonLabel')}</label>
            <input id="reason" name="reason" maxLength={255} disabled={pending} className={inputCls} placeholder={t('vendorRole.onboarding.availabilityManager.reasonPlaceholder')} />
          </div>
        </div>
        {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/5 px-5 text-sm font-medium text-teal hover:bg-teal/10 disabled:opacity-50">
          <CalendarPlus className="h-4 w-4" /> {pending ? t('vendorRole.onboarding.availabilityManager.blocking') : t('vendorRole.onboarding.availabilityManager.submit')}
        </button>
      </form>

      {initial.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-primary">{t('vendorRole.onboarding.availabilityManager.blockedDatesTitle')}</p>
          <ul className="space-y-2">
            {mounted && initial.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-gold/20 bg-surface px-4 py-2.5 shadow-card">
                <span className="text-sm text-primary">
                  {new Date(d.date).toLocaleDateString(localeMap, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {d.reason ? <span className="text-text-muted"> · {d.reason}</span> : null}
                </span>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => {
                    setRemoveErr(null);
                    startRemove(async () => {
                      const r = await removeBlockedDateAction(d.id);
                      if (!r.ok) setRemoveErr(r.error ?? t('vendorRole.onboarding.availabilityManager.removeError'));
                    });
                  }}
                  aria-label={t('vendorRole.onboarding.availabilityManager.removeAriaLabel')}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {removeErr && <p className="mt-2 text-sm text-destructive">{removeErr}</p>}
        </div>
      )}
    </div>
  );
}
