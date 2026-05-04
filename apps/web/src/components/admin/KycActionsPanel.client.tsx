'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const DOC_TYPES = [
  'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
  'UTILITY_BILL', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER',
  'EDUCATION_CERTIFICATE', 'OTHER',
] as const;

interface Props { profileId: string; status: string }

export function KycActionsPanel({ profileId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  async function call(path: string, body?: unknown): Promise<boolean> {
    setBusy(path); setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(json.error?.message ?? 'Action failed');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Network error — retry');
      return false;
    } finally {
      setBusy(null);
    }
  }

  const inactive = status === 'VERIFIED' || status === 'REJECTED';

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Reviewer actions</h3>

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      <label className="block">
        <span className="text-xs font-medium text-foreground">Decision note (optional, shown to user)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button onClick={() => void call(`/api/v1/admin/kyc/${profileId}/approve`, note ? { note } : {})}
          disabled={!!busy || inactive}
          className="bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg px-3 py-2 text-sm min-h-[44px] disabled:opacity-50 transition-colors">
          {busy?.endsWith('approve') ? 'Approving…' : 'Approve KYC'}
        </button>
        <button onClick={() => void call(`/api/v1/admin/kyc/${profileId}/reject`, note ? { note } : {})}
          disabled={!!busy || inactive}
          className="border border-destructive/30 text-destructive font-semibold rounded-lg px-3 py-2 text-sm min-h-[44px] hover:bg-destructive/5 disabled:opacity-50 transition-colors">
          {busy?.endsWith('reject') ? 'Rejecting…' : 'Reject KYC'}
        </button>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Request more info</p>
        <div className="flex gap-2 flex-wrap">
          {DOC_TYPES.map((d) => {
            const on = requiredDocs.includes(d);
            return (
              <button key={d} type="button"
                onClick={() => setRequiredDocs(on ? requiredDocs.filter(x => x !== d) : [...requiredDocs, d])}
                className={`text-[11px] font-semibold rounded-full px-2 py-1 transition-colors ${
                  on ? 'bg-primary text-white' : 'bg-muted/40 text-foreground hover:bg-muted/60'
                }`}>
                {d.replace(/_/g, ' ').toLowerCase()}
              </button>
            );
          })}
        </div>
        <button onClick={() => {
            if (note.trim().length < 10) { setError('Note must be at least 10 characters when requesting info'); return; }
            void call(`/api/v1/admin/kyc/${profileId}/request-info`, { note, requiredDocs });
          }}
          disabled={!!busy || inactive}
          className="w-full bg-warning hover:bg-warning/90 text-white font-semibold rounded-lg px-3 py-2 text-sm min-h-[44px] disabled:opacity-50 transition-colors">
          {busy?.endsWith('request-info') ? 'Sending…' : 'Request info from user'}
        </button>
      </div>

      {inactive && (
        <p className="text-[11px] text-muted-foreground">
          Profile already in terminal state ({status}). Actions disabled.
        </p>
      )}
    </div>
  );
}
