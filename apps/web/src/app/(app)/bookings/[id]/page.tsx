import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BookingStatus } from '@smartshaadi/types';
import { CancelBookingButton } from '@/components/bookings/CancelBookingButton.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface BookingDetail {
  id:            string;
  vendorId:      string;
  vendorName:    string;
  serviceId:     string | null;
  eventDate:     string;
  status:        BookingStatus;
  totalAmount:   number;
  escrowAmount:  number | null;
  paymentStatus: string | null;
  createdAt:     string;
}

interface BookingDetailResponse {
  success: boolean;
  data:    { booking: BookingDetail } | null;
}

async function fetchBooking(id: string): Promise<BookingDetail | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/v1/bookings/${id}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BookingDetailResponse;
    return json.data?.booking ?? null;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-teal-100 text-teal-800 border-teal-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  DISPUTED:  'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:   'Awaiting Confirmation',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED:  'Under Dispute',
};

function EscrowIndicator({ booking }: { booking: BookingDetail }) {
  if (booking.escrowAmount === null && booking.paymentStatus === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        <span className="text-sm text-gray-500">No payment yet</span>
      </div>
    );
  }

  const escrowHeld = booking.escrowAmount !== null && booking.escrowAmount > 0;

  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${escrowHeld ? 'bg-teal-50' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${escrowHeld ? 'bg-teal-500' : 'bg-gray-400'}`} />
        <span className={`text-sm font-medium ${escrowHeld ? 'text-teal-700' : 'text-gray-600'}`}>
          {escrowHeld ? 'Escrow Held' : 'No escrow'}
        </span>
      </div>
      {escrowHeld && booking.escrowAmount !== null && (
        <span className="text-sm font-semibold text-teal-700">
          {formatInr(booking.escrowAmount)}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const booking = await fetchBooking(id);

  if (!booking) {
    notFound();
  }

  const escrowPercent =
    booking.escrowAmount !== null && booking.totalAmount > 0
      ? Math.round((booking.escrowAmount / booking.totalAmount) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">

        {/* Back link */}
        <Link
          href="/bookings"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
        >
          ← Back to Bookings
        </Link>

        {/* Status banner */}
        <div
          className={`mb-6 rounded-xl border px-5 py-4 ${STATUS_STYLES[booking.status]}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide">
              {STATUS_LABELS[booking.status]}
            </span>
            <span className="text-xs opacity-70">
              Booked {new Date(booking.createdAt).toLocaleDateString('en-IN')}
            </span>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-xl border border-gray-100 bg-surface p-6 shadow-sm">

          <h1 className="mb-1 text-xl font-bold text-primary">{booking.vendorName}</h1>
          <p className="text-sm text-gray-400">Booking ID: {booking.id}</p>

          <div className="mt-5 divide-y divide-gray-100">

            {/* Event date */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Event Date</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>

            {/* Total amount */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Total Amount</span>
              <span className="text-lg font-bold text-gray-900">
                {formatInr(booking.totalAmount)}
              </span>
            </div>

            {/* Escrow */}
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">Escrow Status</span>
                {escrowPercent > 0 && (
                  <span className="text-xs text-teal-600">{escrowPercent}% held</span>
                )}
              </div>
              <EscrowIndicator booking={booking} />
            </div>

            {/* Payment status */}
            {booking.paymentStatus && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500">Payment</span>
                <span className="text-sm font-medium text-gray-700">
                  {booking.paymentStatus}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-3">

          {/* Download invoice — only for COMPLETED */}
          {booking.status === 'COMPLETED' && (
            <a
              href={`${API_URL}/api/v1/bookings/${booking.id}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              ↓ Download Invoice
            </a>
          )}

          {/* Cancel — available while PENDING or CONFIRMED */}
          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <CancelBookingButton
              bookingId={booking.id}
              apiUrl={API_URL}
              authToken={token}
            />
          )}

          {/* Back */}
          <Link
            href="/bookings"
            className="rounded-lg border border-gray-200 bg-surface px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Back to list
          </Link>
        </div>

        {/* Escrow notice */}
        {booking.status === 'CONFIRMED' && (
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Escrow Protection:</span>{' '}
              50% of the payment ({formatInr(booking.totalAmount * 0.5)}) will be held in escrow
              and released to the vendor 48 hours after your event is marked complete.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
