'use client';

import { useState } from 'react';
import { submitPanAction } from './actions';

interface Props { verified: boolean; panLast4: string | null }

export function PanVerifyCard({ verified, panLast4 }: Props) {
  const [pan, setPan] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(verified);
  const [last4, setLast4] = useState(panLast4 ?? '');

  if (done) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-success">PAN verified</p>
            {last4 && <p className="text-xs text-muted-foreground mt-0.5">Ending in {last4}</p>}
          </div>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await submitPanAction({ pan: pan.toUpperCase(), nameOnPan: name, dob });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      const data = res.data as { panLast4?: string } | undefined;
      setLast4(data?.panLast4 ?? pan.slice(-4));
    } else {
      setError(res.error ?? 'PAN verification failed');
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Verify PAN (Income Tax)</h3>
        <p className="text-xs text-muted-foreground mt-1">Required for the Premium tier. We never store your PAN — only the last 4 digits.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-foreground">PAN number</span>
          <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())}
            maxLength={10} pattern="[A-Z]{5}[0-9]{4}[A-Z]" required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase tracking-wider"
            placeholder="ABCDE1234F" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-foreground">Date of birth</span>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-foreground">Name (exactly as on PAN)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="As printed on card" />
        </label>
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60 transition-colors">
        {busy ? 'Verifying…' : 'Verify PAN'}
      </button>
    </form>
  );
}
