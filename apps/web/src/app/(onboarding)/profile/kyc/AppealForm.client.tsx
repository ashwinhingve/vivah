'use client';

import { useState } from 'react';
import { fileAppealAction } from './actions';

export function AppealForm() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState(false);

  if (filed) {
    return (
      <div className="rounded-xl border border-success/20 bg-success/5 p-4">
        <p className="text-sm font-semibold text-success">Appeal submitted</p>
        <p className="text-xs text-muted-foreground mt-1">Our team will review within 48 hours and notify you of the decision.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 20) { setError('Please write at least 20 characters explaining your case'); return; }
    setBusy(true);
    setError(null);
    const res = await fileAppealAction({ message: message.trim(), evidenceR2Keys: [] });
    setBusy(false);
    if (res.ok) setFiled(true);
    else setError(res.error ?? 'Could not submit appeal');
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">File an appeal</h3>
        <p className="text-xs text-muted-foreground mt-1">If you believe your verification was wrongly rejected, explain why. Our team re-reviews appeals within 48 hours.</p>
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)}
        rows={5} maxLength={2000} required minLength={20}
        placeholder="Explain in detail (min 20 characters)…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <p className="text-[11px] text-muted-foreground text-right">{message.length}/2000</p>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-4 py-2.5 text-sm min-h-[44px] disabled:opacity-60 transition-colors">
        {busy ? 'Submitting…' : 'Submit appeal'}
      </button>
    </form>
  );
}
