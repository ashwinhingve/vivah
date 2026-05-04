'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Appeal {
  id: string; status: string; userMessage: string;
  rejectionContext: string | null; resolverNote: string | null;
  createdAt: string; resolvedAt: string | null;
}

export function KycAppealResolver({ appeal }: { appeal: Appeal }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'UPHOLD' | 'DENY') {
    setBusy(decision); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/kyc/appeals/${appeal.id}/resolve`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(json.error?.message ?? 'Failed to resolve');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const closed = appeal.status === 'UPHELD' || appeal.status === 'DENIED' || appeal.status === 'WITHDRAWN';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      closed ? 'border-border bg-surface' : 'border-warning/30 bg-warning/5'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Appeal · {appeal.status}</p>
        <p className="text-[11px] text-muted-foreground">{new Date(appeal.createdAt).toLocaleString('en-IN')}</p>
      </div>
      {appeal.rejectionContext && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Original rejection</p>
          <p className="text-sm text-foreground mt-1">{appeal.rejectionContext}</p>
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">User message</p>
        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{appeal.userMessage}</p>
      </div>
      {closed && appeal.resolverNote && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Resolver note</p>
          <p className="text-sm text-foreground mt-1">{appeal.resolverNote}</p>
        </div>
      )}

      {!closed && (
        <>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
            placeholder="Internal note (optional, shown to user)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void decide('UPHOLD')} disabled={!!busy}
              className="bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-3 py-2 text-sm min-h-[44px] disabled:opacity-50 transition-colors">
              {busy === 'UPHOLD' ? 'Upholding…' : 'Uphold (re-verify)'}
            </button>
            <button onClick={() => void decide('DENY')} disabled={!!busy}
              className="border border-destructive/30 text-destructive font-semibold rounded-lg px-3 py-2 text-sm min-h-[44px] hover:bg-destructive/5 disabled:opacity-50 transition-colors">
              {busy === 'DENY' ? 'Denying…' : 'Deny'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
