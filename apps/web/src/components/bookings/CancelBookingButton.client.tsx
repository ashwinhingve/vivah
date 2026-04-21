'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  bookingId: string;
  apiUrl:    string;
  authToken: string;
}

export function CancelBookingButton({ bookingId, apiUrl, authToken }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason]   = useState('');
  const [error, setError]     = useState<string | null>(null);

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/bookings/${bookingId}/cancel`, {
        method:  'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${authToken}`,
        },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!res.ok) throw new Error('Failed to cancel booking');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCancel} className="space-y-3">
      <input
        type="text"
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Cancellation reason (optional)"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
        maxLength={500}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white font-medium py-2 rounded-lg text-sm hover:bg-[#631f33] disabled:opacity-50"
      >
        {loading ? 'Cancelling...' : 'Cancel Booking'}
      </button>
    </form>
  );
}
