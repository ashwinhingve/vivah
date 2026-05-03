import { cookies } from 'next/headers';
import Link from 'next/link';
import { VendorRentalRow } from '@/components/vendor/VendorRentalRow.client';
import type { RentalBookingSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'RETURNED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Active',    value: 'ACTIVE' },
  { label: 'Returned',  value: 'RETURNED' },
];

async function fetchVendorRentals(token: string): Promise<RentalBookingSummary[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/rentals/bookings/vendor`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { bookings?: RentalBookingSummary[] };
    };
    return json.success ? (json.data?.bookings ?? []) : [];
  } catch {
    return [];
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function VendorRentalsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const params = await searchParams;
  const rawStatus = (params.status ?? 'ALL').toUpperCase() as StatusFilter;
  const activeFilter: StatusFilter = STATUS_TABS.some((t) => t.value === rawStatus)
    ? rawStatus
    : 'ALL';

  const all = await fetchVendorRentals(token);
  const filtered = activeFilter === 'ALL'
    ? all
    : all.filter((b) => b.status === activeFilter);

  const counts = {
    pending:   all.filter((b) => b.status === 'PENDING').length,
    confirmed: all.filter((b) => b.status === 'CONFIRMED').length,
    active:    all.filter((b) => b.status === 'ACTIVE').length,
    returned:  all.filter((b) => b.status === 'RETURNED').length,
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-heading text-primary text-2xl font-bold mb-0.5">
            Rental Bookings
          </h1>
          <p className="text-muted-foreground text-sm">Activate and return customer rentals</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Pending"   value={counts.pending}   color="text-warning"   sub="awaiting confirm" />
          <StatCard label="Confirmed" value={counts.confirmed} color="text-teal"    sub="ready to hand off" />
          <StatCard label="Active"    value={counts.active}    color="text-primary"  sub="out with customer" />
          <StatCard label="Returned"  value={counts.returned}  color="text-success" sub="completed" />
        </div>

        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {STATUS_TABS.map(({ label, value }) => {
            const isActive = activeFilter === value;
            const href = value === 'ALL'
              ? '/vendor-dashboard/rentals'
              : `/vendor-dashboard/rentals?status=${value.toLowerCase()}`;
            return (
              <Link
                key={value}
                href={href}
                className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface text-muted-foreground border border-gold/30 hover:bg-background'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gold/30 bg-surface p-10 text-center">
            <p className="text-muted-foreground">No rental bookings match this filter.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((b) => (
              <li key={b.id}>
                <VendorRentalRow booking={b} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div className="rounded-xl border border-gold/30 bg-surface p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold font-heading ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
