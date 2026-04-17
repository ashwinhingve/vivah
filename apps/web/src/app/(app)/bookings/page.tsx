import { cookies } from 'next/headers';
import Link from 'next/link';
import type { BookingSummary, BookingStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface BookingsResponse {
  success: boolean;
  data: {
    bookings: BookingSummary[];
    total:    number;
    page:     number;
    limit:    number;
  } | null;
}

async function fetchBookings(role: 'customer' | 'vendor' = 'customer'): Promise<BookingSummary[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/bookings?role=${role}&limit=20`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as BookingsResponse;
    return json.data?.bookings ?? [];
  } catch {
    return [];
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-teal-100 text-teal-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  DISPUTED:  'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ── Amount formatter ──────────────────────────────────────────────────────────

function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const role = params['role'] === 'vendor' ? 'vendor' : 'customer';
  const bookingList = await fetchBookings(role);

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#7B2D42] sm:text-3xl">My Bookings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track your vendor bookings and download invoices.
            </p>
          </div>

          {/* Role toggle */}
          <div className="flex gap-2 text-sm">
            <Link
              href="/bookings?role=customer"
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                role === 'customer'
                  ? 'bg-[#7B2D42] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              As Customer
            </Link>
            <Link
              href="/bookings?role=vendor"
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                role === 'vendor'
                  ? 'bg-[#7B2D42] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              As Vendor
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {bookingList.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#7B2D42]/10">
              <svg className="h-6 w-6 text-[#7B2D42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">No bookings yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Browse vendors and make your first booking.
            </p>
            <Link
              href="/vendors"
              className="mt-4 inline-flex items-center rounded-lg bg-[#7B2D42] px-4 py-2 text-sm font-medium text-white hover:bg-[#6a2538] transition-colors"
            >
              Explore Vendors
            </Link>
          </div>
        )}

        {/* Booking list */}
        {bookingList.length > 0 && (
          <div className="space-y-4">
            {bookingList.map((booking) => (
              <div
                key={booking.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/bookings/${booking.id}`}
                        className="truncate text-base font-semibold text-gray-900 hover:text-[#7B2D42] transition-colors"
                      >
                        {booking.vendorName}
                      </Link>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>
                        📅{' '}
                        {new Date(booking.eventDate).toLocaleDateString('en-IN', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </span>
                      <span className="font-medium text-gray-700">
                        {formatInr(booking.totalAmount)}
                      </span>
                      {booking.escrowAmount !== null && (
                        <span className="text-teal-600">
                          Escrow: {formatInr(booking.escrowAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="text-sm font-medium text-[#7B2D42] hover:underline"
                    >
                      View details →
                    </Link>
                    {booking.status === 'COMPLETED' && (
                      <a
                        href={`${API_URL}/api/v1/bookings/${booking.id}/invoice`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                      >
                        ↓ Download Invoice
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
