import { cookies } from 'next/headers';
import Link from 'next/link';
import type { BookingSummary, BookingStatus } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface BookingsResponse {
  success: boolean;
  data: { bookings: BookingSummary[]; total: number; page: number; limit: number } | null;
}

async function fetchBookings(
  role: 'customer' | 'vendor',
  status: string,
  timeline: string,
): Promise<BookingSummary[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  const qs = new URLSearchParams({ role, status, timeline, limit: '50' });

  try {
    const res = await fetch(`${API_URL}/api/v1/bookings?${qs.toString()}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as BookingsResponse;
    return json.data?.bookings ?? [];
  } catch { return []; }
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING:   'bg-warning/15 text-warning',
  CONFIRMED: 'bg-teal/15 text-teal',
  COMPLETED: 'bg-success/15 text-success',
  CANCELLED: 'bg-secondary text-muted-foreground',
  DISPUTED:  'bg-destructive/15 text-destructive',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const STATUSES: { value: string; label: string }[] = [
  { value: 'ALL',       label: 'All' },
  { value: 'PENDING',   label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const TIMELINES: { value: string; label: string }[] = [
  { value: 'all',      label: 'All time' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past',     label: 'Past' },
];

interface PageProps {
  searchParams: Promise<{
    role?: string;
    status?: string;
    timeline?: string;
  }>;
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const role:     'customer' | 'vendor' = params.role === 'vendor' ? 'vendor' : 'customer';
  const status   = STATUSES.some((s) => s.value === params.status) ? params.status! : 'ALL';
  const timeline = TIMELINES.some((t) => t.value === params.timeline) ? params.timeline! : 'all';

  const bookingList = await fetchBookings(role, status, timeline);

  function buildHref(patch: Record<string, string>) {
    const q = new URLSearchParams({ role, status, timeline, ...patch });
    return `/bookings?${q.toString()}`;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary sm:text-3xl">My Bookings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track bookings, reschedule, and manage events.</p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href={buildHref({ role: 'customer' })}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                role === 'customer' ? 'bg-primary text-white' : 'bg-surface text-muted-foreground hover:bg-secondary border border-border'
              }`}
            >
              As Customer
            </Link>
            <Link
              href={buildHref({ role: 'vendor' })}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                role === 'vendor' ? 'bg-primary text-white' : 'bg-surface text-muted-foreground hover:bg-secondary border border-border'
              }`}
            >
              As Vendor
            </Link>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {TIMELINES.map((t) => (
            <Link
              key={t.value}
              href={buildHref({ timeline: t.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                timeline === t.value ? 'bg-teal text-white' : 'bg-surface text-muted-foreground border border-border hover:bg-gold/10'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s.value}
              href={buildHref({ status: s.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                status === s.value ? 'bg-primary text-white' : 'bg-surface text-muted-foreground border border-border hover:bg-gold/10'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {bookingList.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="text-base font-semibold text-foreground">No bookings here</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try a different filter or browse vendors.</p>
            <Link
              href="/vendors"
              className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
            >
              Explore Vendors
            </Link>
          </div>
        )}

        {bookingList.length > 0 && (
          <div className="space-y-3">
            {bookingList.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="block rounded-xl border border-border bg-surface p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-base font-semibold text-foreground">{booking.vendorName}</span>
                      <StatusBadge status={booking.status} />
                      {booking.proposedDate && (
                        <span className="inline-flex items-center rounded-full bg-warning/10 text-warning text-xs px-2 py-0.5 font-medium">
                          Reschedule pending
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>📅 {new Date(booking.eventDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="font-medium text-foreground">{formatInr(booking.totalAmount)}</span>
                      {booking.escrowAmount !== null && booking.escrowAmount > 0 && (
                        <span className="text-teal">Escrow: {formatInr(booking.escrowAmount)}</span>
                      )}
                      {booking.packageName && <span className="text-primary">{booking.packageName}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium text-primary">View →</span>
                    {booking.status === 'COMPLETED' && role === 'customer' && !booking.hasReview && (
                      <span className="inline-flex items-center rounded-full bg-warning/10 text-warning text-xs px-2 py-0.5 font-medium">
                        Review pending
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
