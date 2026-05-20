'use client';

import { useState } from 'react';
import { reverifyAction } from './actions';

interface Props { expiresAt: string | null }

export function ReverifyBanner({ expiresAt }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!expiresAt) return null;

  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const daysLeft = Math.ceil((exp - now) / 86_400_000);
  if (daysLeft > 30) return null;

  async function trigger() {
    setBusy(true);
    setError(null);
    const res = await reverifyAction();
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Could not start re-verification');
  }

  const expired = daysLeft <= 0;
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${
      expired ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5'
    }`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={expired ? 'var(--color-destructive)' : 'var(--color-warning)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 mt-0.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${expired ? 'text-destructive' : 'text-warning'}`}>
          {expired ? 'Your verification has expired' : `Your verification expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Re-verify now to keep your trust badge active and stay visible in match feeds.
        </p>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        <button onClick={() => void trigger()} disabled={busy}
          className="mt-3 inline-flex items-center bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-3 py-1.5 text-xs disabled:opacity-60 transition-colors">
          {busy ? 'Starting…' : 'Re-verify now'}
        </button>
      </div>
    </div>
  );
}
