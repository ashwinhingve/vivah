'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { CartDrawer } from './CartDrawer.client';

export function CartButton() {
  const [open, setOpen] = useState(false);
  const totalItems = useCartStore(s => s.totalItems);

  const count = totalItems();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#64748B] hover:text-[#7B2D42] hover:bg-[#C5A47E]/10 transition-colors"
        aria-label={`Open cart${count > 0 ? `, ${count} items` : ''}`}
      >
        <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#7B2D42] text-white text-[9px] font-bold rounded-full px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
