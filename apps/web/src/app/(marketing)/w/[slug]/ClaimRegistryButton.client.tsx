'use client';

import { useState, useTransition } from 'react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function ClaimRegistryButton({ itemId, accent }: { itemId: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClaim() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/wedding-sites/registry/${itemId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimerName: name.trim() }),
        });
        const json = await res.json() as { success: boolean; error?: { message?: string } };
        if (!json.success) {
          setError(json.error?.message ?? 'Claim failed');
          return;
        }
        setDone(true);
      } catch {
        setError('Network error');
      }
    });
  }

  if (done) return <span className="text-xs text-green-700 italic shrink-0">Claimed — thank you!</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white shrink-0" style={{ backgroundColor: accent }}>
        Claim
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus
        className="text-xs rounded border border-[#C5A47E]/30 px-2 py-1 w-32" />
      <button onClick={handleClaim} disabled={isPending || !name.trim()}
        className="text-xs px-3 py-1 rounded bg-[#0E7C7B] text-white disabled:opacity-50">
        OK
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
