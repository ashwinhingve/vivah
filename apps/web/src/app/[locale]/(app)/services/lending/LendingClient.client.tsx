'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LoanOffer } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { recordLendingConsentAction } from './actions';

interface LendingClientProps {
  initialOffers: LoanOffer[];
  isPreview: boolean;
}

function formatINR(paise: string): string {
  const rupees = Number(BigInt(paise)) / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function LendingClient({ initialOffers, isPreview }: LendingClientProps) {
  const t = useTranslations('servicesLending');
  const [selected, setSelected] = useState<string | null>(null);
  const [consent, setConsent] = useState(false); // never pre-ticked
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected || !consent) return;
    setStatus('saving');
    setError(null);
    const result = await recordLendingConsentAction({ offerRef: selected });
    if (result.success) {
      setStatus('done');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong');
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview / not-live banner */}
      {isPreview && (
        <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4 text-sm text-gold-muted">
          <span className="font-semibold">{t('previewBanner.title')}</span>{' '}
          {t('previewBanner.description')}
        </div>
      )}

      {/* LSP disclosure — Smart Shaadi is not the lender */}
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
          {/* Neutral multi-offer list — no steering, no highlighted "best" */}
          <RadioGroup
            className="gap-4"
            value={selected ?? ''}
            onValueChange={(value) => setSelected(value)}
          >
            {initialOffers.length === 0 && (
              <p className="text-text-muted">{t('noOffers')}</p>
            )}
            {initialOffers.map((o) => (
              <div
                key={o.offerRef}
                onClick={() => setSelected(o.offerRef)}
                className={`block cursor-pointer rounded-2xl border p-4 shadow-card transition ${
                  selected === o.offerRef ? 'border-teal ring-1 ring-teal bg-surface' : 'border-gold/20 bg-surface'
                }`}
              >
                <div className="flex items-start gap-4 min-h-[44px]">
                  <RadioGroupItem
                    value={o.offerRef}
                    className="mt-1 shrink-0"
                    aria-label={t('selectOffer', { name: o.reName })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading text-lg text-primary">{o.reName}</p>
                      <p className="text-lg font-semibold text-foreground">{formatINR(o.amountPaise)}</p>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-muted sm:grid-cols-3">
                      <div><dt className="inline">{t('tenure')}: </dt><dd className="inline text-foreground">{o.tenorMonths} mo</dd></div>
                      <div><dt className="inline">{t('apr')}: </dt><dd className="inline text-foreground">{o.aprPct}%</dd></div>
                      <div><dt className="inline">{t('monthly')}: </dt><dd className="inline text-foreground">{formatINR(o.monthlyPaise)}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-text-muted">{o.penalChargesNote}</p>
                    <a
                      href={o.kfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-teal underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('viewKfs')}
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
