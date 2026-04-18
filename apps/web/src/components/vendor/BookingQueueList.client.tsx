'use client';

import { useState } from 'react';
import type { BookingSummary } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  initialBookings: BookingSummary[];
}

export function BookingQueueList({ initialBookings }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateBooking(bookingId: string, action: 'confirm' | 'cancel') {
    setLoading(bookingId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/bookings/${bookingId}/${action}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'cancel' ? JSON.stringify({ reason: 'Declined by vendor' }) : '{}',
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? 'Action failed');
        return;
      }
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: action === 'confirm' ? 'CONFIRMED' : 'CANCELLED' }
            : b,
        ),
      );
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(null);
    }
  }

  const pending = bookings.filter((b) => b.status === 'PENDING');

  if (pending.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#C5A47E]/40 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#7B2D42]">No pending bookings</p>
        <p className="text-xs text-[#6B6B76] mt-1">New requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {pending.map((booking) => (
        <div
          key={booking.id}
          className="rounded-xl border border-[#C5A47E]/40 bg-white p-4 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2E2E38] truncate">{booking.vendorName}</p>
            <p className="text-xs text-[#6B6B76] mt-0.5">
              {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}₹{booking.totalAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => void updateBooking(booking.id, 'confirm')}
              disabled={loading === booking.id}
              className="px-3 py-1.5 rounded-lg bg-[#0E7C7B] text-white text-xs font-semibold min-h-[36px] hover:bg-[#149998] transition-colors disabled:opacity-50"
            >
              {loading === booking.id ? '…' : 'Confirm'}
            </button>
            <button
              onClick={() => void updateBooking(booking.id, 'cancel')}
              disabled={loading === booking.id}
              className="px-3 py-1.5 rounded-lg border border-[#DC2626]/30 text-[#DC2626] text-xs font-semibold min-h-[36px] hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
