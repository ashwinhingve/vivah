'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RentalBookingSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function patchBooking(id: string, action: 'confirm' | 'activate' | 'return'): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/rentals/bookings/${id}/${action}`, {
      method: 'PUT',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function VendorRentalRow({ booking }: { booking: RentalBookingSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: 'confirm' | 'activate' | 'return') {
    setError(null);
    startTransition(async () => {
      const ok = await patchBooking(booking.id, action);
      if (!ok) {
        setError(`Failed to ${action} booking`);
        return;
      }
      router.refresh();
    });
  }

  const from = new Date(booking.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const to   = new Date(booking.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <div className="rounded-xl border border-[#C5A47E]/30 bg-surface p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-[#0F172A]">{booking.itemName}</p>
        <p className="text-xs text-[#64748B]">
          {from} → {to} · Qty {booking.quantity} · ₹{booking.totalAmount.toLocaleString('en-IN')}
        </p>
        <StatusBadge status={booking.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        {booking.status === 'PENDING' && (
          <ActionButton label="Confirm" disabled={pending} onClick={() => act('confirm')} />
        )}
        {booking.status === 'CONFIRMED' && (
          <ActionButton label="Activate" disabled={pending} onClick={() => act('activate')} />
        )}
        {booking.status === 'ACTIVE' && (
          <ActionButton label="Mark Returned" disabled={pending} onClick={() => act('return')} />
        )}
        {booking.status === 'RETURNED' && (
          <span className="text-xs text-emerald-600 font-medium">Completed</span>
        )}
      </div>
      {error && <p className="text-xs text-destructive w-full">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: RentalBookingSummary['status'] }) {
  const map: Record<string, string> = {
    PENDING:   'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-teal/10 text-teal',
    ACTIVE:    'bg-purple-100 text-purple-700',
    RETURNED:  'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-secondary text-muted-foreground',
  };
  const cls = map[status] ?? 'bg-secondary text-muted-foreground';
  return (
    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-[#7B2D42] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#5E1F30] disabled:opacity-50"
    >
      {disabled ? 'Working…' : label}
    </button>
  );
}
