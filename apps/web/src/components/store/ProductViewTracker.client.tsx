'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

interface ProductViewTrackerProps {
  productId: string;
  category?: string;
}

export function ProductViewTracker({ productId, category }: ProductViewTrackerProps) {
  useEffect(() => {
    track('store_product_viewed', { productId, ...(category && { category }) });
  }, [productId, category]);

  return null;
}
