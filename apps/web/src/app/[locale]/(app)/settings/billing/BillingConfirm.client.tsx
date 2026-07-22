'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { subscribeToPlanAction } from './actions';

interface Props {
  planCode:  string;
  planName:  string;
  amount:    number;
  interval:  string;
  features:  string[];
  isMock:    boolean;
}

export function BillingConfirm({ planCode, planName, amount, interval, features, isMock }: Props) {
  const t = useTranslations('billing');
  const locale = useLocale();
  const numberLocale = locale === 'hi' ? 'hi-IN' : 'en-IN';
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await subscribeToPlanAction(planCode);
      if (result && 'ok' in result && !result.ok) setError(result.error);
    });
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gold/40 bg-surface p-8 shadow-card">
      {isMock ? (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
          {t('testMode')}
        </div>
      ) : null}

      <h2 className="mb-1 text-2xl font-semibold text-primary">{planName}</h2>
      <p className="mb-6 text-3xl font-bold text-foreground">
        ₹{amount.toLocaleString(numberLocale)}
        <span className="ml-2 text-sm font-normal text-muted-foreground">/ {interval}</span>
      </p>

      {features.length > 0 ? (
        <ul className="mb-6 space-y-2 text-sm text-foreground">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-success">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="w-full"
      >
        {pending ? t('processing') : t('confirmPay')}
      </Button>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
