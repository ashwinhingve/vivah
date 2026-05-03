'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

export function CartPageClient() {
  const router         = useRouter();
  const items          = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem     = useCartStore(s => s.removeItem);
  const totalPrice     = useCartStore(s => s.totalPrice);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#64748B]">
        <ShoppingBag className="h-16 w-16 text-[#C5A47E]/30" />
        <p className="text-base font-medium">Your cart is empty</p>
        <Link
          href="/store"
          className="mt-2 px-6 py-2.5 min-h-[44px] flex items-center bg-[#0E7C7B] text-white font-semibold rounded-lg text-sm hover:bg-[#0E7C7B]/90 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const subtotal = totalPrice();

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Items list */}
      <div className="md:col-span-2 space-y-3">
        {items.map(item => (
          <div
            key={item.productId}
            className="flex gap-4 bg-surface border border-[#C5A47E]/20 rounded-xl p-4"
          >
            {/* Image */}
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[#FEFAF6]">
              {item.imageKey ? (
                <img
                  src={`/api/r2/${encodeURIComponent(item.imageKey)}`}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-8 w-8 text-[#C5A47E]/30" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#0F172A] truncate">{item.name}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{item.vendorName}</p>
              <p className="text-sm font-semibold text-[#C5A47E] mt-1">
                ₹{item.price.toLocaleString('en-IN')} each
              </p>

              {/* Qty + remove */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#C5A47E]/30 text-[#64748B] hover:bg-[#C5A47E]/10 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-medium text-[#0F172A] w-8 text-center">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#C5A47E]/30 text-[#64748B] hover:bg-[#C5A47E]/10 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                <span className="ml-auto text-sm font-bold text-[#0E7C7B]">
                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                </span>

                <button
                  onClick={() => removeItem(item.productId)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-destructive/80 hover:bg-destructive/10 transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Order summary */}
      <div className="bg-surface border border-[#C5A47E]/20 rounded-xl p-4 h-fit sticky top-24">
        <h2 className="font-heading text-[#7B2D42] font-semibold text-base mb-4">Order Summary</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-[#64748B]">
            <span>Subtotal</span>
            <span className="text-[#0F172A] font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-[#64748B]">
            <span>Shipping</span>
            <span className="text-success font-medium">Free</span>
          </div>
          <div className="border-t border-[#C5A47E]/20 pt-2 flex justify-between font-semibold text-[#0F172A]">
            <span>Total</span>
            <span className="text-[#0E7C7B]">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button
          onClick={() => router.push('/store/checkout')}
          className="w-full mt-4 min-h-[44px] bg-[#0E7C7B] text-white font-semibold rounded-lg text-sm hover:bg-[#0E7C7B]/90 transition-colors"
        >
          Proceed to Checkout
        </button>

        <Link
          href="/store"
          className="block text-center mt-2 text-xs text-[#64748B] hover:text-[#0E7C7B] transition-colors py-2"
        >
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
