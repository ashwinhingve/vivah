'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CancelOrderButtonProps {
  orderId: string;
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function CancelOrderButton({ orderId }: CancelOrderButtonProps) {
  const router     = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState(false);

  async function handleCancel() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/orders/${orderId}/cancel`, {
        method:      'PUT',
        credentials: 'include',
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not cancel order');
        setConfirm(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setConfirm(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleCancel}
        disabled={loading}
        className={[
          'min-h-[44px] px-4 text-sm font-semibold rounded-lg border transition-colors disabled:opacity-60',
          confirm
            ? 'bg-destructive text-white border-destructive hover:bg-destructive'
            : 'bg-surface text-destructive border-destructive/40 hover:bg-destructive/10',
        ].join(' ')}
      >
        {loading ? 'Cancelling…' : confirm ? 'Confirm Cancel' : 'Cancel Order'}
      </button>
      {confirm && !loading && (
        <button
          onClick={() => setConfirm(false)}
          className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Keep order
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
