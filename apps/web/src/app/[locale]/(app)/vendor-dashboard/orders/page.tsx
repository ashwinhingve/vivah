import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Package } from 'lucide-react';
import { VendorOrderRow } from '@/components/store/VendorOrderRow.client';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import type { VendorOrderItem } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type StatusFilter = 'ALL' | 'PENDING' | 'SHIPPED' | 'DELIVERED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Shipped',   value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
];

async function fetchVendorOrders(token: string): Promise<VendorOrderItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/vendor/orders`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { orders?: VendorOrderItem[]; items?: VendorOrderItem[] };
    };
    if (!json.success) return [];
    // API returns { orders: [...] }; tolerate legacy { items } shape.
    return json.data?.orders ?? json.data?.items ?? [];
  } catch {
    return [];
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function VendorOrdersPage({ searchParams }: PageProps) {
  const t = await getTranslations('vendorRole.orders');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const params = await searchParams;
  const rawStatus = (params.status ?? 'ALL').toUpperCase() as StatusFilter;
  const activeFilter: StatusFilter = STATUS_TABS.some((t) => t.value === rawStatus)
    ? rawStatus
    : 'ALL';

  const allItems = await fetchVendorOrders(token);

  const filteredItems =
    activeFilter === 'ALL'
      ? allItems
      : allItems.filter((i) => i.fulfilmentStatus === activeFilter);

  const pendingCount = allItems.filter((i) => i.fulfilmentStatus === 'PENDING').length;
  const shippedCount = allItems.filter((i) => i.fulfilmentStatus === 'SHIPPED').length;
  const deliveredCount = allItems.filter((i) => i.fulfilmentStatus === 'DELIVERED').length;

  const revenue = allItems
    .filter((i) => i.fulfilmentStatus === 'DELIVERED')
    .reduce((sum, i) => sum + parseFloat(String(i.subtotal ?? '0')), 0);
  const revenueLabel = revenue > 0
    ? `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '₹0';

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
            <StatsCard label={t('statPending')} value={pendingCount} sub={t('statPendingSub')} icon={Package} variant="warning" />
            <StatsCard label={t('statShipped')} value={shippedCount} sub={t('statShippedSub')} icon={Package} variant="default" />
            <StatsCard label={t('statDelivered')} value={deliveredCount} sub={t('statDeliveredSub')} icon={Package} variant="success" />
            <StatsCard label={t('statRevenue')} value={revenueLabel} sub={t('statRevenueSub')} icon={Package} variant="gold" />
          </StaggerList>

          <FadeUp>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {STATUS_TABS.map(({ value }) => {
                const isActive = activeFilter === value;
                return (
                  <Link
                    key={value}
                    href={value === 'ALL' ? '/vendor-dashboard/orders' : `?status=${value.toLowerCase()}`}
                    className={`shrink-0 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                      isActive
                        ? 'bg-teal text-white'
                        : 'bg-surface border border-gold/20 text-muted-foreground hover:border-teal hover:text-teal'
                    }`}
                  >
                    {t(`tab${value}`)}
                  </Link>
                );
              })}
            </div>
          </FadeUp>

          <FadeUp>
            {filteredItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title={activeFilter === 'ALL' ? t('emptyAll') : t('emptyFiltered', { status: activeFilter.toLowerCase() })}
                description={activeFilter === 'ALL' ? t('emptyAllDesc') : t('emptyFilteredDesc', { status: activeFilter.toLowerCase() })}
              />
            ) : (
              <StaggerList className="space-y-3">
                {filteredItems.map((item) => (
                  <VendorOrderRow key={item.id} item={item} />
                ))}
              </StaggerList>
            )}
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
