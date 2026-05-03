import Link from 'next/link';
import { fetchAuth } from '@/lib/server-fetch';
import type { OrderSummary, OrderStatus } from '@smartshaadi/types';

interface OrdersResponse {
  orders: OrderSummary[];
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  PLACED:    { label: 'Placed',    cls: 'bg-amber-50  text-amber-700'    },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-teal/10   text-teal'     },
  SHIPPED:   { label: 'Shipped',   cls: 'bg-purple-50 text-purple-700'   },
  DELIVERED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-secondary  text-muted-foreground'     },
  REFUNDED:  { label: 'Refunded',  cls: 'bg-secondary  text-muted-foreground'     },
};

export default async function OrdersPage() {
  const data = await fetchAuth<OrdersResponse>('/api/v1/store/orders');
  const orders = data?.orders ?? [];

  // Sort newest first
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/store" className="text-[#64748B] hover:text-[#0E7C7B] transition-colors text-sm">
            ← Store
          </Link>
          <h1 className="font-heading text-[#7B2D42] text-xl font-bold">My Orders</h1>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#64748B]">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-[#C5A47E]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium">No orders yet</p>
            <Link
              href="/store"
              className="px-5 py-2.5 min-h-[44px] flex items-center bg-[#0E7C7B] text-white font-semibold rounded-lg text-sm hover:bg-[#0E7C7B]/90 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(order => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PLACED;
              return (
                <Link
                  key={order.id}
                  href={`/store/orders/${order.id}`}
                  className="block bg-surface border border-[#C5A47E]/20 rounded-xl p-4 hover:border-[#0E7C7B]/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#64748B] font-medium">
                        Order #{order.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="font-semibold text-[#0F172A] mt-0.5">
                        ₹{order.total.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${cfg.cls}`}>
                      {cfg.label}
                    </span>
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
