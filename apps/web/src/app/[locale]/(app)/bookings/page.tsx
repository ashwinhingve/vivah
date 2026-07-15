import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { Calendar, ChevronRight } from 'lucide-react';
import type { BookingSummary, BookingStatus } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';

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

const STATUS_VARIANT: Record<BookingStatus, 'warning' | 'tealSoft' | 'success' | 'neutral' | 'error'> = {
  PENDING:   'warning',
  CONFIRMED: 'tealSoft',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  DISPUTED:  'error',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
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
    <PageTransition>
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <PageHeader
            title="My Bookings"
            subtitle="Track bookings, reschedule, and manage events."
            actions={
              <div className="flex gap-2 text-sm" role="group" aria-label="Viewing as">
                <Link
                  href={buildHref({ role: 'customer' })}
                  aria-current={role === 'customer' ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    role === 'customer' ? 'bg-primary text-white' : 'bg-surface text-muted-foreground hover:bg-secondary border border-border'
                  }`}
                >
                  As Customer
                </Link>
                <Link
                  href={buildHref({ role: 'vendor' })}
                  aria-current={role === 'vendor' ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    role === 'vendor' ? 'bg-primary text-white' : 'bg-surface text-muted-foreground hover:bg-secondary border border-border'
                  }`}
                >
                  As Vendor
                </Link>
              </div>
            }
          />

          <div className="mb-3 flex flex-wrap gap-2">
            {TIMELINES.map((t) => (
              <Link
                key={t.value}
                href={buildHref({ timeline: t.value })}
                aria-current={timeline === t.value ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
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
                aria-current={status === s.value ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  status === s.value ? 'bg-primary text-white' : 'bg-surface text-muted-foreground border border-border hover:bg-gold/10'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {bookingList.length === 0 && (
            <EmptyState
              variant="no-bookings"
              title="No bookings here"
              description="Try a different filter or browse vendors to make your first booking."
              actionLabel="Explore Vendors"
              actionHref="/vendors"
            />
          )}

          {bookingList.length > 0 && (
            <StaggerList className="space-y-3">
              {bookingList.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="group flex items-start justify-between gap-4 rounded-2xl border border-gold/20 bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-base font-semibold text-foreground">{booking.vendorName}</span>
                      <StatusBadge status={booking.status} />
                      {booking.proposedDate && (
                        <Badge variant="warning">Reschedule pending</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {new Date(booking.eventDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <span className="font-medium text-foreground">{formatInr(booking.totalAmount)}</span>
                      {booking.escrowAmount !== null && booking.escrowAmount > 0 && (
                        <span className="text-teal">Escrow: {formatInr(booking.escrowAmount)}</span>
                      )}
                      {booking.packageName && <span className="text-primary">{booking.packageName}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-primary">
                      View
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                    {booking.status === 'COMPLETED' && role === 'customer' && !booking.hasReview && (
                      <Badge variant="warning">Review pending</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </StaggerList>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
