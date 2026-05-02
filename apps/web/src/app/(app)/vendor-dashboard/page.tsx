import { cookies } from 'next/headers';
import Link from 'next/link';
import { BookingQueueList } from '@/components/vendor/BookingQueueList.client';
import { InquiriesInbox } from '@/components/vendor/InquiriesInbox.client';
import { BlockedDatesManager } from '@/components/vendor/BlockedDatesManager.client';
import { VendorProfileEditor } from '@/components/vendor/VendorProfileEditor.client';
import type { BookingSummary, VendorInquiry, VendorBlockedDate, VendorProfile } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const TABS: Array<{ value: string; label: string }> = [
  { value: 'overview',  label: 'Overview' },
  { value: 'inquiries', label: 'Inquiries' },
  { value: 'calendar',  label: 'Calendar' },
  { value: 'profile',   label: 'Profile' },
];

async function fetchAuth<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: T };
    return json.success ? json.data : null;
  } catch { return null; }
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function VendorDashboardPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.value === tabParam) ? tabParam! : 'overview';

  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  // Always load bookings for overview stats
  const [bookingsData, inquiriesData, blockedData, vendorMine] = await Promise.all([
    fetchAuth<{ bookings: BookingSummary[]; total: number }>('/api/v1/bookings?role=vendor&limit=100', token),
    fetchAuth<{ inquiries: VendorInquiry[]; total: number }>('/api/v1/vendors/inquiries?limit=50', token),
    fetchAuth<{ dates: VendorBlockedDate[] }>('/api/v1/vendors/blocked-dates', token),
    fetchAuth<VendorProfile>('/api/v1/vendors/me', token).catch(() => null),
  ]);

  const allBookings = bookingsData?.bookings ?? [];
  const inquiries   = inquiriesData?.inquiries ?? [];
  const blocked     = blockedData?.dates ?? [];

  // Resolve vendor profile via /vendors/:id when /me missing — fall back to first booking's vendorId
  let vendorProfile = vendorMine;
  if (!vendorProfile && allBookings[0]?.vendorId) {
    vendorProfile = await fetchAuth<VendorProfile>(`/api/v1/vendors/${allBookings[0].vendorId}`, token);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingCount       = allBookings.filter((b) => b.status === 'PENDING').length;
  const confirmedThisMonth = allBookings.filter((b) => b.status === 'CONFIRMED' && new Date(b.eventDate) >= monthStart).length;
  const totalRevenue       = allBookings.filter((b) => b.status === 'COMPLETED').reduce((s, b) => s + b.totalAmount, 0);
  const newInquiries       = inquiries.filter((i) => i.status === 'NEW').length;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">Vendor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your bookings, inquiries, and profile.</p>
        </div>

        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-gold/30 pb-2">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/vendor-dashboard?tab=${t.value}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.value ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-gold/10'
              }`}
            >
              {t.label}
              {t.value === 'inquiries' && newInquiries > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5">{newInquiries}</span>
              )}
            </Link>
          ))}
        </nav>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Pending" value={pendingCount} sub="bookings" />
              <StatCard label="Confirmed" value={confirmedThisMonth} sub="this month" />
              <StatCard label="Revenue" value={`₹${(totalRevenue / 1000).toFixed(1)}k`} sub="total earned" />
              <StatCard label="Rating" value={vendorProfile?.rating?.toFixed(1) ?? '—'} sub={`${vendorProfile?.totalReviews ?? 0} reviews`} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-primary font-heading mb-3">Pending Requests</h2>
              <BookingQueueList initialBookings={allBookings} />
            </div>

            {allBookings.filter((b) => b.status === 'CONFIRMED').length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-primary font-heading mb-3">Upcoming Events</h2>
                <div className="space-y-2">
                  {allBookings.filter((b) => b.status === 'CONFIRMED').slice(0, 5).map((b) => (
                    <div key={b.id} className="rounded-xl border border-gold/30 bg-surface px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(b.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">₹{b.totalAmount.toLocaleString('en-IN')}</p>
                      </div>
                      <span className="text-xs font-semibold text-success bg-green-50 px-2 py-1 rounded-full">Confirmed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'inquiries' && (
          <InquiriesInbox initial={inquiries} />
        )}

        {tab === 'calendar' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Block dates so customers can't book when you're unavailable.</p>
            <BlockedDatesManager initial={blocked} />
          </div>
        )}

        {tab === 'profile' && (
          vendorProfile ? (
            <VendorProfileEditor vendor={vendorProfile} />
          ) : (
            <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-6 text-center text-sm text-muted-foreground">
              Vendor profile not found.
            </div>
          )
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-surface p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold font-heading text-teal">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
