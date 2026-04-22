import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchAuth } from '@/lib/server-fetch';
import { CancelOrderButton } from '@/components/store/CancelOrderButton.client';
import type { OrderDetail, OrderStatus, FulfilmentStatus } from '@smartshaadi/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  PLACED:    { label: 'Placed',    cls: 'bg-amber-50  text-amber-700'    },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-blue-50   text-blue-700'     },
  SHIPPED:   { label: 'Shipped',   cls: 'bg-purple-50 text-purple-700'   },
  DELIVERED: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100  text-gray-500'     },
  REFUNDED:  { label: 'Refunded',  cls: 'bg-gray-100  text-gray-500'     },
};

const FULFILMENT_CONFIG: Record<FulfilmentStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'text-amber-700'  },
  SHIPPED:   { label: 'Shipped',   cls: 'text-purple-700' },
  DELIVERED: { label: 'Delivered', cls: 'text-emerald-700'},
};

const CANCELLABLE: OrderStatus[] = ['PLACED', 'CONFIRMED'];

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order  = await fetchAuth<OrderDetail>(`/api/v1/store/orders/${id}`);

  if (!order) notFound();

  const statusCfg    = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PLACED;
  const canCancel    = CANCELLABLE.includes(order.status);

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/store/orders" className="text-[#64748B] hover:text-[#0E7C7B] transition-colors text-sm">
            ← Orders
          </Link>
          <h1 className="font-heading text-[#7B2D42] text-xl font-bold">Order Details</h1>
        </div>

        {/* Status card */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-[#64748B] font-medium">
                Order #{order.id.slice(-8).toUpperCase()}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5">
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
            <div className="mt-4 pt-4 border-t border-[#C5A47E]/20">
              <CancelOrderButton orderId={order.id} />
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-sm mb-3">Items</h2>
          <div className="space-y-3">
            {order.items.map(item => {
              const ful = FULFILMENT_CONFIG[item.fulfilmentStatus] ?? FULFILMENT_CONFIG.PENDING;
              return (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{item.productName}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Qty {item.quantity} × ₹{item.unitPrice.toLocaleString('en-IN')}
                    </p>
                    <p className={`text-[10px] font-medium mt-0.5 ${ful.cls}`}>{ful.label}</p>
                    {item.trackingNumber && (
                      <p className="text-[10px] text-[#64748B] mt-0.5">
                        Tracking: <span className="font-mono font-medium">{item.trackingNumber}</span>
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-[#0E7C7B] text-sm flex-shrink-0">
                    ₹{item.subtotal.toLocaleString('en-IN')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-sm mb-3">Order Summary</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-[#64748B]">
              <span>Subtotal</span>
              <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Shipping</span>
              <span className="text-emerald-700">
                {order.shippingFee === 0 ? 'Free' : `₹${order.shippingFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="flex justify-between font-bold text-[#0F172A] border-t border-[#C5A47E]/20 pt-2">
              <span>Total</span>
              <span className="text-[#0E7C7B]">₹{order.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Shipping address */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-4 mb-4">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-sm mb-2">Shipping Address</h2>
          <div className="text-sm text-[#64748B] space-y-0.5">
            <p className="font-medium text-[#0F172A]">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.address}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}</p>
            <p>{order.shippingAddress.phone}</p>
          </div>
        </div>

        {/* Payment refs */}
        {(order.razorpayOrderId || order.razorpayPaymentId) && (
          <div className="bg-white border border-[#C5A47E]/20 rounded-xl p-4">
            <h2 className="font-heading text-[#7B2D42] font-semibold text-sm mb-2">Payment</h2>
            <div className="text-xs text-[#64748B] space-y-1">
              {order.razorpayOrderId && (
                <p>Order ID: <span className="font-mono text-[#0F172A]">{order.razorpayOrderId}</span></p>
              )}
              {order.razorpayPaymentId && (
                <p>Payment ID: <span className="font-mono text-[#0F172A]">{order.razorpayPaymentId}</span></p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
