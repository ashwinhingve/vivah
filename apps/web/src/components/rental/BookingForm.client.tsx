'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RentalItem } from '@smartshaadi/types';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Props {
  item: RentalItem;
}

export function BookingForm({ item }: Props) {
  const router = useRouter();

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(today);
  const [toDate,   setToDate]   = useState(tomorrow);
  const [quantity, setQuantity] = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Live total calculator
  function calcTotal(): number {
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return 0;
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
    return days * item.pricePerDay * quantity;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/rentals/${item.id}/book`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalItemId: item.id, fromDate, toDate, quantity }),
      });

      const json = (await res.json()) as { success: boolean; error?: { message: string } };

      if (!json.success) {
        setError(json.error?.message ?? 'Booking failed. Please try again.');
        return;
      }

      router.push('/rentals/bookings/mine');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const total = calcTotal();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From date
          <input
            type="date"
            required
            value={fromDate}
            min={today}
            onChange={(e) => setFromDate(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gold/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          To date
          <input
            type="date"
            required
            value={toDate}
            min={fromDate || today}
            onChange={(e) => setToDate(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gold/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Quantity
        <input
          type="number"
          required
          min={1}
          max={item.stockQty}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="min-h-[44px] rounded-lg border border-gold/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        <span className="text-[10px] text-muted-foreground">Max: {item.stockQty}</span>
      </label>

      {/* Live total preview */}
      {total > 0 && (
        <div className="rounded-lg bg-teal/10 px-4 py-3 text-sm">
          <div className="flex justify-between text-foreground">
            <span className="text-muted-foreground">Estimated total</span>
            <span className="font-bold text-teal">{inrFormatter.format(total)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Deposit (on booking)</span>
            <span>{inrFormatter.format(item.deposit * quantity)}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || total === 0}
        className="w-full min-h-[44px] rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Booking…' : 'Confirm Booking Request'}
      </button>
    </form>
  );
}
