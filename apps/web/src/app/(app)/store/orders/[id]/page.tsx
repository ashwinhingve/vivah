import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import { CancelOrderButton } from '@/components/store/CancelOrderButton.client';
import type { OrderDetail, OrderStatus, FulfilmentStatus } from '@smartshaadi/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  PLACED:    { label: 'Placed',    cls: 'bg-warning/10  text-warning'    },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-teal/10   text-teal'     },
  SHIPPED:   { label: 'Shipped',   cls: 'bg-primary/10 text-primary'   },
  DELIVERED: { label: 'Delivered', cls: 'bg-success/10 text-success' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-secondary  text-muted-foreground'     },
  REFUNDED:  { label: 'Refunded',  cls: 'bg-secondary  text-muted-foreground'     },
};

const FULFILMENT_CONFIG: Record<FulfilmentStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'text-warning'  },
  SHIPPED:   { label: 'Shipped',   cls: 'text-primary' },
  DELIVERED: { label: 'Delivered', cls: 'text-success'},
};

const CANCELLABLE: OrderStatus[] = ['PLACED', 'CONFIRMED'];

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order  = await fetchAuth<OrderDetail>(`/api/v1/store/orders/${id}`);

  if (!order) notFound();

  const statusCfg    = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PLACED;
  const canCancel    = CANCELLABLE.includes(order.status);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/store/orders" className="text-muted-foreground hover:text-teal transition-colors text-sm">
            ← Orders
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">Order Details</h1>
        </div>

        {/* Status card */}
        <div className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Order #{order.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          </div>

          {canCancel && (
            <div className="mt-4 pt-4 border-t border-gold/20">
              <CancelOrderButton orderId={order.id} />
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-primary font-semibold text-sm mb-3">Items</h2>
          <div className="space-y-3">
            {order.items.map(item => {
              const ful = FULFILMENT_CONFIG[item.fulfilmentStatus] ?? FULFILMENT_CONFIG.PENDING;
              return (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Qty {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                    </p>
                    <p className={`text-[10px] font-medium mt-0.5 ${ful.cls}`}>{ful.label}</p>
                    {item.trackingNumber && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Tracking: <span className="font-mono font-medium">{item.trackingNumber}</span>
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-teal text-sm flex-shrink-0">
                    ₹{item.subtotal.toLocaleString('en-IN')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-primary font-semibold text-sm mb-3">Order Summary</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span className="text-success">
                {order.shippingFee === 0 ? 'Free' : `₹${order.shippingFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-foreground border-t border-gold/20 pt-2">
              <span>Total</span>
              <span className="text-teal">₹{order.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Shipping address */}
        <div className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-primary font-semibold text-sm mb-2">Shipping Address</h2>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.address}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}</p>
            <p>{order.shippingAddress.phone}</p>
          </div>
        </div>

        {/* Payment refs */}
        {(order.razorpayOrderId || order.razorpayPaymentId) && (
          <div className="bg-surface border border-gold/20 rounded-xl p-4">
            <h2 className="font-heading text-primary font-semibold text-sm mb-2">Payment</h2>
            <div className="text-xs text-muted-foreground space-y-1">
              {order.razorpayOrderId && (
                <p>Order ID: <span className="font-mono text-foreground">{order.razorpayOrderId}</span></p>
              )}
              {order.razorpayPaymentId && (
                <p>Payment ID: <span className="font-mono text-foreground">{order.razorpayPaymentId}</span></p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
