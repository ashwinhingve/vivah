import Link from 'next/link';
import type { ProductSummary } from '@smartshaadi/types';

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const stockLabel =
    product.stockQty === 0
      ? { text: 'Out of Stock', cls: 'text-destructive bg-destructive/10' }
      : product.stockQty < 5
      ? { text: 'Low Stock', cls: 'text-amber-700 bg-amber-50' }
      : { text: 'In Stock', cls: 'text-emerald-700 bg-emerald-50' };

  return (
    <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-[#FEFAF6]">
        {product.imageKey ? (
          <img
            src={`/api/r2/${encodeURIComponent(product.imageKey)}`}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#C5A47E]/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-2 left-2 bg-[#C5A47E] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            ⭐ Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Category badge */}
        <span className="inline-block self-start text-[10px] font-medium bg-[#C5A47E]/10 text-[#C5A47E] px-2 py-0.5 rounded-full">
          {product.category}
        </span>

        {/* Name */}
        <h3 className="font-heading text-[#7B2D42] font-semibold text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Price row */}
        <div className="flex items-baseline gap-2">
          <span className="text-[#0E7C7B] font-semibold text-sm">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="text-[#94A3B8] text-xs line-through">
              ₹{product.comparePrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Stock */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full self-start ${stockLabel.cls}`}>
          {stockLabel.text}
        </span>

        {/* CTA */}
        <Link
          href={`/store/${product.id}`}
          className="mt-auto block text-center text-xs font-semibold text-[#0E7C7B] border border-[#0E7C7B] rounded-lg py-2 min-h-[44px] flex items-center justify-center hover:bg-[#0E7C7B]/5 transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
