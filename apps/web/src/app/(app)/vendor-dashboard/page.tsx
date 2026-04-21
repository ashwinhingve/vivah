import { cookies } from 'next/headers';
import { BookingQueueList } from '@/components/vendor/BookingQueueList.client';
import type { BookingSummary } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function VendorDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const bookingsData = await fetchAuth<{ bookings: BookingSummary[]; total: number }>(
    '/api/v1/bookings?role=vendor&limit=100',
    token,
  );

  const allBookings = bookingsData?.bookings ?? [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingCount = allBookings.filter((b) => b.status === 'PENDING').length;
  const confirmedThisMonth = allBookings.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.eventDate) >= monthStart,
  ).length;
  const totalRevenue = allBookings
    .filter((b) => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">Vendor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your bookings and earnings</p>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold font-heading text-teal">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">bookings</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Confirmed</p>
            <p className="text-2xl font-bold font-heading text-teal">{confirmedThisMonth}</p>
            <p className="text-xs text-muted-foreground">this month</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold font-heading text-teal">
              ₹{(totalRevenue / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-muted-foreground">total earned</p>
          </div>
          <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rating</p>
            <p className="text-2xl font-bold font-heading text-teal">—</p>
            <p className="text-xs text-muted-foreground">reviews coming</p>
          </div>
        </div>

        {/* Booking queue */}
        <div>
          <h2 className="text-lg font-semibold text-primary font-heading mb-3">
            Pending Requests
          </h2>
          <BookingQueueList initialBookings={allBookings} />
        </div>

        {/* Recent confirmed bookings */}
        {allBookings.filter((b) => b.status === 'CONFIRMED').length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-primary font-heading mb-3">
              Upcoming Events
            </h2>
            <div className="space-y-2">
              {allBookings
                .filter((b) => b.status === 'CONFIRMED')
                .slice(0, 5)
                .map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-gold/30 bg-surface px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(b.eventDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <span className="text-xs font-semibold text-success bg-green-50 px-2 py-1 rounded-full">
                      Confirmed
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
