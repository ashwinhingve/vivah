import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BookingStatus, BookingAddon } from '@smartshaadi/types';
import { CancelBookingButton } from '@/components/bookings/CancelBookingButton.client';
import { RescheduleControls } from '@/components/bookings/RescheduleControls.client';
import { VendorReviews } from '@/components/vendor/VendorReviews.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface BookingDetail {
  id:             string;
  vendorId:       string;
  vendorName:     string;
  serviceId:      string | null;
  eventDate:      string;
  ceremonyType?:  string;
  status:         BookingStatus;
  totalAmount:    number;
  escrowAmount:   number | null;
  paymentStatus:  string | null;
  createdAt:      string;
  packageName?:   string | null;
  packagePrice?:  number | null;
  guestCount?:    number | null;
  eventLocation?: string | null;
  proposedDate?:  string | null;
  proposedBy?:    string | null;
  proposedReason?: string | null;
  addons?:        BookingAddon[];
  hasReview?:     boolean;
}

interface BookingDetailResponse {
  success: boolean;
  data:    { booking: BookingDetail } | null;
}

async function fetchBooking(id: string, token: string): Promise<BookingDetail | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/bookings/${id}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BookingDetailResponse;
    return json.data?.booking ?? null;
  } catch { return null; }
}

function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:   'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-teal-100 text-teal-800 border-teal-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-secondary text-muted-foreground border-border',
  DISPUTED:  'bg-destructive/15 text-destructive border-destructive/30',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:   'Awaiting Confirmation',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED:  'Under Dispute',
};

export default async function BookingDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const booking = await fetchBooking(id, token);
  if (!booking) notFound();

  const addonsTotal = (booking.addons ?? []).reduce(
    (sum, a) => sum + (a.unitPrice ?? 0) * (a.quantity ?? 1),
    0,
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          ← Back to Bookings
        </Link>

        <div className={`rounded-xl border px-5 py-4 ${STATUS_STYLES[booking.status]}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide">{STATUS_LABELS[booking.status]}</span>
            <span className="text-xs opacity-70">Booked {new Date(booking.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
          <RescheduleControls
            bookingId={booking.id}
            currentDate={booking.eventDate}
            proposedDate={booking.proposedDate ?? null}
            proposedReason={booking.proposedReason ?? null}
          />
        )}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
          <div>
            <Link href={`/vendors/${booking.vendorId}`} className="text-xl font-bold text-primary hover:underline">
              {booking.vendorName}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">Booking ID: {booking.id}</p>
          </div>

          <dl className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Event Date</dt>
              <dd className="text-sm font-medium text-foreground">
                {new Date(booking.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </dd>
            </div>
            {booking.ceremonyType && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Ceremony</dt>
                <dd className="text-sm font-medium text-foreground capitalize">{booking.ceremonyType.toLowerCase().replace(/_/g, ' ')}</dd>
              </div>
            )}
            {booking.guestCount && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Guest count</dt>
                <dd className="text-sm font-medium text-foreground">{booking.guestCount.toLocaleString('en-IN')}</dd>
              </div>
            )}
            {booking.eventLocation && (
              <div className="flex items-center justify-between py-3 gap-3">
                <dt className="text-sm text-muted-foreground shrink-0">Location</dt>
                <dd className="text-sm font-medium text-foreground text-right">{booking.eventLocation}</dd>
              </div>
            )}
            {booking.packageName && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Package</dt>
                <dd className="text-sm font-medium text-foreground">
                  {booking.packageName}
                  {booking.packagePrice != null && (
                    <span className="text-muted-foreground ml-2">{formatInr(booking.packagePrice)}</span>
                  )}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Total</dt>
              <dd className="text-lg font-bold text-foreground">{formatInr(booking.totalAmount)}</dd>
            </div>
            {booking.escrowAmount !== null && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Escrow Held</dt>
                <dd className="text-sm font-medium text-teal-700">{formatInr(booking.escrowAmount)}</dd>
              </div>
            )}
            {booking.paymentStatus && (
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Payment</dt>
                <dd className="text-sm font-medium text-foreground">{booking.paymentStatus}</dd>
              </div>
            )}
          </dl>
        </div>

        {booking.addons && booking.addons.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-primary mb-3">Add-ons</h2>
            <ul className="divide-y divide-gray-100">
              {booking.addons.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">
                    {a.name}
                    <span className="text-muted-foreground ml-2">×{a.quantity}</span>
                  </span>
                  <span className="font-medium text-foreground">{formatInr(a.unitPrice * a.quantity)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-2 text-sm border-t-2 border-border mt-1 pt-2">
                <span className="font-semibold text-primary">Add-ons total</span>
                <span className="font-bold text-primary">{formatInr(addonsTotal)}</span>
              </li>
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
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
          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <CancelBookingButton bookingId={booking.id} apiUrl={API_URL} authToken={token} />
          )}
          <Link
            href="/bookings"
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            Back to list
          </Link>
        </div>

        {booking.status === 'COMPLETED' && !booking.hasReview && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-base font-semibold text-amber-900 mb-2">How was your experience?</h2>
            <p className="text-sm text-amber-800 mb-3">Leave a review to help other couples find great vendors.</p>
            <VendorReviews
              vendorId={booking.vendorId}
              initial={[]}
              total={0}
              canReview={true}
              bookingId={booking.id}
            />
          </div>
        )}

        {booking.status === 'CONFIRMED' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Escrow Protection:</span>{' '}
              50% of the payment ({formatInr(booking.totalAmount * 0.5)}) is held in escrow and released to the vendor 48 hours after your event.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
