'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface OverviewResponse {
  account: { deletionRequestedAt: string | null };
}

export default function RecoveryActions() {
  const router = useRouter();
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [pendingAt, setPendingAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/me/security/overview`, { credentials: 'include' });
        if (!res.ok) {
          if (alive) router.replace('/login');
          return;
        }
        const json = (await res.json()) as { data: OverviewResponse };
        if (!alive) return;
        const at = json.data.account.deletionRequestedAt;
        if (!at) { router.replace('/dashboard'); return; }
        setPendingAt(at);
      } finally {
        if (alive) setLoadingOverview(false);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  const restore = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/me/account/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Could not restore');
        return;
      }
      router.replace('/dashboard');
    } finally { setBusy(false); }
  };

  const cancelAndSignOut = async () => {
    await authClient.signOut().catch(() => {});
    router.replace('/account/deleted');
  };

  if (loadingOverview) {
    return (
      <div className="flex w-full max-w-md justify-center rounded-2xl border border-gold/25 bg-surface/92 p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grace = pendingAt ? new Date(pendingAt) : null;
  if (grace) grace.setDate(grace.getDate() + 30);
  const daysLeft = grace ? Math.max(0, Math.ceil((grace.getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <div className="relative w-full max-w-md space-y-6 rounded-2xl border border-gold/25 bg-surface/92 p-8 shadow-xl backdrop-blur-md">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Trash2 className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-primary">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is scheduled for deletion in{' '}
          <span className="font-semibold text-foreground">{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>.
          Restore it now to keep your matches, conversations, and bookings.
        </p>
      </div>

      {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => { void restore(); }}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Restore my account
      </Button>

      <button
        type="button"
        onClick={() => { void cancelAndSignOut(); }}
        className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        Continue with deletion
      </button>
    </div>
  );
}
