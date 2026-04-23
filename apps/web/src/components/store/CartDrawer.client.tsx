'use client';

import { useRouter } from 'next/navigation';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const router = useRouter();
  const items          = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem     = useCartStore(s => s.removeItem);
  const totalPrice     = useCartStore(s => s.totalPrice);

  function handleCheckout() {
    onClose();
    router.push('/store/checkout');
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#FEFAF6] shadow-xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#C5A47E]/20">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-base">Your Cart</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#C5A47E]/10 transition-colors"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#64748B] py-12">
              <ShoppingBag className="h-12 w-12 text-[#C5A47E]/40" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.productId}
                className="flex gap-3 bg-white border border-[#C5A47E]/20 rounded-xl p-3"
              >
                {/* Image */}
                <div className="w-14 h-14 rounded-lg bg-[#FEFAF6] flex-shrink-0 overflow-hidden">
                  {item.imageKey ? (
                    <img
                      src={`/api/r2/${encodeURIComponent(item.imageKey)}`}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#C5A47E]/40">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">{item.name}</p>
                  <p className="text-[10px] text-[#64748B]">{item.vendorName}</p>
                  <p className="text-sm font-semibold text-[#0E7C7B] mt-0.5">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </p>

                  {/* Qty controls */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-[#C5A47E]/30 text-[#64748B] hover:bg-[#C5A47E]/10 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium text-[#0F172A] w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border border-[#C5A47E]/30 text-[#64748B] hover:bg-[#C5A47E]/10 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>

                    <button
                      onClick={() => removeItem(item.productId)}
                      className="ml-auto min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#C5A47E]/20 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Subtotal</span>
              <span className="font-semibold text-[#0F172A]">
                ₹{totalPrice().toLocaleString('en-IN')}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full min-h-[44px] bg-[#0E7C7B] text-white font-semibold rounded-lg text-sm hover:bg-[#0E7C7B]/90 transition-colors"
            >
              Checkout
            </button>
            <button
              onClick={onClose}
              className="w-full min-h-[44px] border border-[#C5A47E]/40 text-[#64748B] font-medium rounded-lg text-sm hover:bg-[#C5A47E]/10 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
