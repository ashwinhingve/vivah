'use client';

import { useState } from 'react';
import type { InsuranceQuote } from '@smartshaadi/types';
import { recordInsuranceConsentAction } from './actions';

interface InsuranceClientProps {
  initialQuotes: InsuranceQuote[];
  isPreview: boolean;
}

const SKU_LABEL: Record<string, string> = {
  HEALTH: 'Health',
  LIFE: 'Life',
  TRAVEL: 'Travel',
  WEDDING: 'Wedding event',
};

function formatINR(paise: string): string {
  const rupees = Number(BigInt(paise)) / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export function InsuranceClient({ initialQuotes, isPreview }: InsuranceClientProps) {
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
        <div className="rounded-2xl border border-gold bg-gold/10 p-4 text-sm text-gold-muted">
          <span className="font-semibold">Not live yet — preview.</span>{' '}
          Insurance is shown for preview only and is not available until our
          IRDAI-compliant partner is live. No application is submitted and no data
          leaves Smart Shaadi.
        </div>
      )}

      <div className="rounded-2xl border border-teal/30 bg-white p-4 text-sm text-foreground">
        <p>
          <span className="font-semibold text-teal">Smart Shaadi refers you to
          IRDAI-registered insurers.</span>{' '}
          Cover is provided by the insurer named on each quote — Smart Shaadi is not
          the insurer and earns a referral fee, never your premium.
        </p>
        <p className="mt-2 text-muted">
          We lead with standard health cover; life, travel, and wedding-event
          protection are also available.
        </p>
      </div>

      {status === 'done' ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="font-heading text-lg text-green-800">Preference recorded</p>
          <p className="mt-1 text-sm text-green-700">
            We&apos;ve noted your consent. When our insurance partner is live you&apos;ll
            be referred to the insurer with full policy disclosures.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {initialQuotes.length === 0 && <p className="text-muted">No quotes to show right now.</p>}
            {initialQuotes.map((q) => (
              <label
                key={q.quoteRef}
                className={`block cursor-pointer rounded-2xl border p-4 shadow-card transition ${
                  selected === q.quoteRef ? 'border-teal ring-1 ring-teal' : 'border-gray-200'
                } bg-white`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="insurance-quote"
                    className="mt-1 h-5 w-5"
                    checked={selected === q.quoteRef}
                    onChange={() => setSelected(q.quoteRef)}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-muted">
                        {SKU_LABEL[q.sku] ?? q.sku}
                      </span>
                      {q.lead && (
                        <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-heading text-lg text-primary">{q.insurerName}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted">
                      <div><dt className="inline">Cover: </dt><dd className="inline text-foreground">{formatINR(q.sumAssuredPaise)}</dd></div>
                      <div><dt className="inline">Premium: </dt><dd className="inline text-foreground">{formatINR(q.premiumPaise)}</dd></div>
                    </dl>
                    <a
                      href={q.insurerGrievanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-teal underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Insurer grievance & redressal
                    </a>
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Explicit, un-pre-ticked consent */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I consent to Smart Shaadi sharing the details needed to refer me to the
                selected insurer. I understand Smart Shaadi is a referrer, earns a
                referral fee, and does not collect my premium.
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="button"
            disabled={!selected || !consent || status === 'saving'}
            onClick={handleContinue}
            className="h-11 w-full rounded-lg bg-teal px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving…' : 'Continue'}
          </button>
        </>
      )}
    </div>
  );
}
