import { Link } from '@/i18n/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { fetchAuth } from '@/lib/server-fetch';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import type { OrderSummary, OrderStatus } from '@smartshaadi/types';

interface OrdersResponse {
  orders: OrderSummary[];
}

const STATUS_TONE_MAP: Record<OrderStatus, StatusTone> = {
  PLACED:    'warning',
  CONFIRMED: 'teal',
  SHIPPED:   'primary',
  DELIVERED: 'success',
  CANCELLED: 'neutral',
  REFUNDED:  'neutral',
};

export default async function OrdersPage() {
  const t = await getTranslations('store.orders');
  const data = await fetchAuth<OrdersResponse>('/api/v1/store/orders');
  const orders = data?.orders ?? [];

  // Sort newest first
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/store" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-teal transition-colors text-sm min-h-[44px]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToStore') ?? 'Store'}
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">{t('title') ?? 'My Orders'}</h1>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 text-gold/30" aria-hidden="true" />
            <p className="text-sm font-medium">{t('emptyLabel') ?? 'No orders yet'}</p>
            <Link
              href="/store"
              className="px-5 py-2.5 min-h-[44px] flex items-center bg-teal text-white font-semibold rounded-lg text-sm hover:bg-teal/90 transition-colors"
            >
              {t('browseCta') ?? 'Browse Products'}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(order => {
              const tone = STATUS_TONE_MAP[order.status] ?? STATUS_TONE_MAP.PLACED;
              const statusKey = order.status.toLowerCase() as Lowercase<OrderStatus>;
              return (
                <Link
                  key={order.id}
                  href={`/store/orders/${order.id}`}
                  className="block bg-surface border border-gold/20 rounded-xl p-4 hover:border-teal/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="font-semibold text-foreground mt-0.5">
                        ₹{order.total.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <StatusChip tone={tone} className="text-2xs font-semibold flex-shrink-0">
                      {t(`statusLabels.${statusKey}`)}
                    </StatusChip>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
