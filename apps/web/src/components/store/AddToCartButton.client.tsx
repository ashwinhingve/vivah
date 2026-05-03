'use client';

import { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import type { ProductSummary } from '@smartshaadi/types';

interface AddToCartButtonProps {
  product: ProductSummary;
  disabled?: boolean;
}

export function AddToCartButton({ product, disabled }: AddToCartButtonProps) {
  const addItem = useCartStore(s => s.addItem);
  const [added, setAdded] = useState(false);

  const isDisabled = disabled || product.stockQty === 0;

  function handleClick() {
    if (isDisabled || added) return;
    addItem({
      productId:  product.id,
      name:       product.name,
      price:      product.price,
      imageKey:   product.imageKey,
      quantity:   1,
      vendorId:   product.vendorId,
      vendorName: product.vendorName,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={[
        'flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
        isDisabled
          ? 'bg-secondary text-muted-foreground cursor-not-allowed'
          : added
          ? 'bg-emerald-600 text-white'
          : 'bg-[#0E7C7B] text-white hover:bg-[#0E7C7B]/90 active:scale-95',
      ].join(' ')}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Added ✓
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {product.stockQty === 0 ? 'Out of Stock' : 'Add to Cart'}
        </>
      )}
    </button>
  );
}
