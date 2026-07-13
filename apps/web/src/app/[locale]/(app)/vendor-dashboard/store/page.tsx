import { Link } from '@/i18n/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Plus, Package } from 'lucide-react';
import { VendorProductCard } from '@/components/store/VendorProductCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProductSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchVendorProducts(token: string): Promise<ProductSummary[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/vendor/products`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { products: ProductSummary[] };
    };
    return json.success ? (json.data?.products ?? []) : [];
  } catch {
    return [];
  }
}

export default async function VendorStorePage() {
  const t = await getTranslations('vendorRole.store');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const products = await fetchVendorProducts(token);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const outOfStock = products.filter((p) => p.stockQty === 0).length;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <FadeUp>
            <div className="flex items-start justify-between gap-4">
              <div>
                <PageHeader
                  title={t('title')}
                  subtitle={t('subtitle')}
                />
              </div>
              <Link
                href="/vendor-dashboard/store/new"
                className={cn(buttonVariants(), 'shrink-0 min-h-[44px] gap-1.5')}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('addProduct')}
              </Link>
            </div>
          </FadeUp>

          <StaggerList className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatsCard label={t('statTotal')} value={totalProducts} sub={t('statTotalSub')} icon={Package} />
            <StatsCard label={t('statActive')} value={activeProducts} sub={t('statActiveSub')} icon={Package} variant="teal" />
            <StatsCard label={t('statOutOfStock')} value={outOfStock} sub={t('statOutOfStockSub')} icon={Package} variant="warning" />
            <StatsCard label={t('statRevenue')} value="—" sub={t('statRevenueSub')} icon={Package} variant="gold" />
          </StaggerList>

          <FadeUp>
            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('emptyTitle')}
                description={t('emptyDescription')}
                action={
                  <Link
                    href="/vendor-dashboard/store/new"
                    className={cn(buttonVariants(), 'gap-1.5')}
                  >
                    {t('addFirstProduct')}
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <VendorProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
