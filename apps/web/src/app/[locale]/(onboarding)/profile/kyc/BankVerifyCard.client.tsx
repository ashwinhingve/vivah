'use client';

import { useState } from 'react';
import { submitBankAction } from './actions';

interface Props { verified: boolean; accountLast4: string | null; ifsc: string | null }

export function BankVerifyCard({ verified, accountLast4, ifsc }: Props) {
  const [accountNumber, setAccount] = useState('');
  const [ifscCode, setIfsc] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(verified);
  const [last4, setLast4] = useState(accountLast4 ?? '');

  if (done) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-success">Bank account verified</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ifsc ? `${ifsc} · ` : ''}A/c ending {last4}</p>
          </div>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await submitBankAction({ accountNumber, ifsc: ifscCode.toUpperCase(), accountHolderName: holder });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setLast4(accountNumber.slice(-4));
    } else {
      setError(res.error ?? 'Bank verification failed');
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Verify bank account</h3>
        <p className="text-xs text-muted-foreground mt-1">A penny is sent and refunded instantly. We confirm the account holder name only.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-foreground">Account number</span>
          <input inputMode="numeric" pattern="\d{9,18}" value={accountNumber}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
            required maxLength={18}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">IFSC</span>
          <input value={ifscCode} onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            maxLength={11} pattern="[A-Z]{4}0[A-Z0-9]{6}" required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase tracking-wider" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">Account holder name</span>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} required minLength={2} maxLength={100}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60 transition-colors">
        {busy ? 'Sending penny-drop…' : 'Verify bank account'}
      </button>
    </form>
  );
}
