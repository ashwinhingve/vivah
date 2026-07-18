'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InsuranceQuote } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { recordInsuranceConsentAction } from './actions';

interface InsuranceClientProps {
  initialQuotes: InsuranceQuote[];
  isPreview: boolean;
}

function formatINR(paise: string): string {
  const rupees = Number(BigInt(paise)) / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function InsuranceClient({ initialQuotes, isPreview }: InsuranceClientProps) {
  const t = useTranslations('servicesInsurance');
  const [selected, setSelected] = useState<string | null>(null);
  const [consent, setConsent] = useState(false); // never pre-ticked
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const selectedQuote = initialQuotes.find((q) => q.quoteRef === selected) ?? null;

  const handleContinue = async () => {
    if (!selectedQuote || !consent) return;
    setStatus('saving');
    setError(null);
    const result = await recordInsuranceConsentAction({
      quoteRef: selectedQuote.quoteRef,
      sku: selectedQuote.sku,
    });
    if (result.success) {
      setStatus('done');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong');
    }
  };

  return (
    <div className="space-y-6">
      {isPreview && (
        <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm text-gold-muted">
          <span className="font-semibold">{t('previewBanner.title')}</span>{' '}
          {t('previewBanner.description')}
        </div>
      )}

      <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card text-sm text-foreground">
        <p>
          <span className="font-semibold text-primary">{t('disclosure.title')}</span>{' '}
          {t('disclosure.description')}
        </p>
        <p className="mt-2 text-text-muted">
          {t('disclosure.detail')}
        </p>
      </div>

      {status === 'done' ? (
        <div className="rounded-2xl border border-success/20 bg-success/10 p-6 text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          </div>
          <p className="font-heading text-lg text-primary">{t('successTitle')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t('successDescription')}
          </p>
        </div>
      ) : (
        <>
          <RadioGroup
            className="gap-4"
            value={selected ?? ''}
            onValueChange={(value) => setSelected(value)}
          >
            {initialQuotes.length === 0 && <p className="text-text-muted">{t('noQuotes')}</p>}
            {initialQuotes.map((q) => (
              <div
                key={q.quoteRef}
                onClick={() => setSelected(q.quoteRef)}
                className={`block cursor-pointer rounded-2xl border p-4 shadow-card transition ${
                  selected === q.quoteRef ? 'border-teal ring-1 ring-teal bg-surface' : 'border-gold/20 bg-surface'
                }`}
              >
                <div className="flex items-start gap-4 min-h-[44px]">
                  <RadioGroupItem
                    value={q.quoteRef}
                    className="mt-1 shrink-0"
                    aria-label={t('selectQuote', { name: q.insurerName })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-muted">
                        {t(`skuLabels.${q.sku}` as const) ?? q.sku}
                      </span>
                      {q.lead && (
                        <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                          {t('recommendedBadge')}
                        </span>
                      )}
                    </div>
                    <p className="font-heading text-lg text-primary">{q.insurerName}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-muted">
                      <div><dt className="inline">{t('cover')}: </dt><dd className="inline text-foreground">{formatINR(q.sumAssuredPaise)}</dd></div>
                      <div><dt className="inline">{t('premium')}: </dt><dd className="inline text-foreground">{formatINR(q.premiumPaise)}</dd></div>
                    </dl>
                    <a
                      href={q.insurerGrievanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-teal underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('insurerGrievance')}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>

          {/* Explicit, un-pre-ticked consent */}
          <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card">
            <label className="flex items-start gap-3 text-sm text-foreground min-h-[44px]">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 cursor-pointer accent-teal"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {t('consentText')}
              </span>
            </label>
          </div>

          {error && (
            <div className="flex gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="button"
            disabled={!selected || !consent || status === 'saving'}
            onClick={handleContinue}
            className="w-full"
            loading={status === 'saving'}
          >
            {t('continue')}
          </Button>
        </>
      )}
    </div>
  );
}
