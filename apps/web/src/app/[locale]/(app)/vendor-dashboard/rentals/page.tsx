import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AlertCircle, Package } from 'lucide-react';
import { VendorRentalRow } from '@/components/vendor/VendorRentalRow.client';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
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
  const t = await getTranslations('vendorRole.rentals');
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
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <FadeUp>
            <PageHeader
              title={t('title')}
              subtitle={t('subtitle')}
            />
          </FadeUp>

          <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatsCard label={t('statPending')} value={counts.pending} sub={t('statPendingSub')} icon={AlertCircle} variant="warning" />
            <StatsCard label={t('statConfirmed')} value={counts.confirmed} sub={t('statConfirmedSub')} icon={Package} variant="teal" />
            <StatsCard label={t('statActive')} value={counts.active} sub={t('statActiveSub')} icon={Package} variant="default" />
            <StatsCard label={t('statReturned')} value={counts.returned} sub={t('statReturnedSub')} icon={Package} variant="success" />
          </StaggerList>

          <FadeUp>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {STATUS_TABS.map(({ value }) => {
                const isActive = activeFilter === value;
                const href = value === 'ALL'
                  ? '/vendor-dashboard/rentals'
                  : `/vendor-dashboard/rentals?status=${value.toLowerCase()}`;
                return (
                  <Link
                    key={value}
                    href={href}
                    className={`shrink-0 min-h-[44px] px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-surface text-muted-foreground border border-gold/20 hover:border-primary/40'
                    }`}
                  >
                    {t(`tab${value}`)}
                  </Link>
                );
              })}
            </div>
          </FadeUp>

          <FadeUp>
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title={`No ${activeFilter.toLowerCase()} rentals`}
                description={t('emptyMessage')}
              />
            ) : (
              <StaggerList className="space-y-3">
                {filtered.map((b) => (
                  <VendorRentalRow key={b.id} booking={b} />
                ))}
              </StaggerList>
            )}
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
