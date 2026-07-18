'use client';

import { useState } from 'react';
import type { LoanOffer } from '@smartshaadi/types';
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
        <div className="rounded-2xl border border-gold bg-gold/10 p-4 text-sm text-gold-muted">
          <span className="font-semibold">Not live yet — preview.</span>{' '}
          Wedding financing is shown for preview only and is not available until our
          RBI-compliant lending partner is live. No application is submitted and no
          data leaves Smart Shaadi.
        </div>
      )}

      {/* LSP disclosure — Smart Shaadi is not the lender */}
      <div className="rounded-2xl border border-teal/30 bg-white p-4 text-sm text-foreground">
        <p>
          <span className="font-semibold text-teal">Smart Shaadi is a Loan Service
          Provider (LSP), not the lender.</span>{' '}
          We only surface offers from RBI-regulated lenders. Loans are provided by
          the lender named on each offer.
        </p>
        <p className="mt-2 text-muted">
          Funds are disbursed <span className="font-medium">directly to your bank
          account</span> and repayments go <span className="font-medium">directly to
          the lender</span>. Smart Shaadi never handles your money.
        </p>
      </div>

      {status === 'done' ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="font-heading text-lg text-green-800">Preference recorded</p>
          <p className="mt-1 text-sm text-green-700">
            We&apos;ve noted your consent. When our lending partner is live you&apos;ll
            be referred with a Key Fact Statement before any agreement.
          </p>
        </div>
      ) : (
        <>
          {/* Neutral multi-offer list — no steering, no highlighted "best" */}
          <div className="space-y-4">
            {initialOffers.length === 0 && (
              <p className="text-muted">No offers to show right now.</p>
            )}
            {initialOffers.map((o) => (
              <label
                key={o.offerRef}
                className={`block cursor-pointer rounded-2xl border p-4 shadow-card transition ${
                  selected === o.offerRef ? 'border-teal ring-1 ring-teal' : 'border-gray-200'
                } bg-white`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="loan-offer"
                    className="mt-1 h-5 w-5"
                    checked={selected === o.offerRef}
                    onChange={() => setSelected(o.offerRef)}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading text-lg text-primary">{o.reName}</p>
                      <p className="text-lg font-semibold text-foreground">{formatINR(o.amountPaise)}</p>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-3">
                      <div><dt className="inline">Tenure: </dt><dd className="inline text-foreground">{o.tenorMonths} mo</dd></div>
                      <div><dt className="inline">APR: </dt><dd className="inline text-foreground">{o.aprPct}%</dd></div>
                      <div><dt className="inline">Monthly: </dt><dd className="inline text-foreground">{formatINR(o.monthlyPaise)}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-muted">{o.penalChargesNote}</p>
                    <a
                      href={o.kfsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-teal underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Key Fact Statement (KFS)
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
                selected lender. I understand Smart Shaadi is an LSP, earns a referral
                fee from the lender, and never collects interest or handles my money.
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
