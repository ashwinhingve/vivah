/**
 * My Rental Bookings — Server Component
 *
 * Fetches GET /api/v1/rentals/bookings/mine with auth cookie.
 * Shows item name, dates, quantity, total amount, status badge.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchAuth } from '@/lib/server-fetch';
import type { RentalBookingSummary } from '@smartshaadi/types';

export const metadata: Metadata = {
  title: 'My Rentals — Smart Shaadi',
  description: 'View your rental bookings and their status.',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: 'bg-warning/15',  text: 'text-warning',  label: 'Pending' },
  CONFIRMED: { bg: 'bg-teal/15',   text: 'text-teal',   label: 'Confirmed' },
  ACTIVE:    { bg: 'bg-success/15',  text: 'text-success',  label: 'Active' },
  RETURNED:  { bg: 'bg-secondary',   text: 'text-muted-foreground',   label: 'Returned' },
  CANCELLED: { bg: 'bg-destructive/15',    text: 'text-destructive',    label: 'Cancelled' },
  OVERDUE:   { bg: 'bg-warning/15', text: 'text-warning', label: 'Overdue' },
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

interface BookingsResponse {
  bookings: RentalBookingSummary[];
}

export default async function MyRentalsPage() {
  const data = await fetchAuth<BookingsResponse>('/api/v1/rentals/bookings/mine');
  const bookings = data?.bookings ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary font-heading">My Rentals</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your rental bookings</p>
          </div>
          <Link
            href="/rentals"
            className="text-sm font-medium text-teal hover:underline"
          >
            Browse catalogue →
          </Link>
        </div>

        {/* Error / empty state */}
        {!data && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load your bookings.</p>
            <p className="text-xs text-destructive mt-1">Please refresh or try again later.</p>
          </div>
        )}

        {data && bookings.length === 0 && (
          <div className="rounded-xl border border-gold/30 bg-surface p-8 text-center space-y-3">
            <p className="text-lg font-semibold text-primary">No rentals yet</p>
            <p className="text-sm text-muted-foreground">
              Browse our catalogue and rent decor, costumes, and more for your wedding.
            </p>
            <Link
              href="/rentals"
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              Browse catalogue
            </Link>
          </div>
        )}

        {/* Bookings list */}
        {bookings.length > 0 && (
          <ul className="space-y-3">
            {bookings.map((booking) => {
              const style = STATUS_STYLES[booking.status] ?? STATUS_STYLES['PENDING']!;
              return (
                <li
                  key={booking.id}
                  className="rounded-xl bg-surface border border-gold/20 shadow-sm p-4 space-y-3"
                >
                  {/* Item name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-primary leading-snug">
                      {booking.itemName}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{formatDate(booking.fromDate)}</span>
                    {' — '}
                    <span className="font-medium text-foreground">{formatDate(booking.toDate)}</span>
                  </div>

                  {/* Quantity + Total */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Qty: <span className="font-medium text-foreground">{booking.quantity}</span></span>
                    <span>Total: <span className="font-medium text-foreground">{inrFormatter.format(booking.totalAmount)}</span></span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
