import { Link } from '@/i18n/navigation';
import { ImageOff, Star } from 'lucide-react';
import type { ProductSummary } from '@smartshaadi/types';

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const stockLabel =
    product.stockQty === 0
      ? { text: 'Out of Stock', cls: 'text-destructive bg-destructive/10' }
      : product.stockQty < 5
      ? { text: 'Low Stock', cls: 'text-warning bg-warning/10' }
      : { text: 'In Stock', cls: 'text-success bg-success/10' };

  return (
    <div className="group bg-surface border border-gold/20 rounded-2xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-background overflow-hidden">
        {product.imageKey ? (
          <img
            src={`/api/r2/${encodeURIComponent(product.imageKey)}`}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gold/40">
            <ImageOff className="w-12 h-12" strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-2 left-2 bg-gold text-white text-2xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-white" aria-hidden="true" /> Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Category badge */}
        <span className="inline-block self-start text-2xs font-medium bg-gold/10 text-gold px-2 py-0.5 rounded-full">
          {product.category}
        </span>

        {/* Name */}
        <h3 className="font-heading text-primary font-semibold text-sm leading-snug line-clamp-2">
          {product.name}
        </h3>

        {/* Price row */}
        <div className="flex items-baseline gap-2">
          <span className="text-teal font-semibold text-sm">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="text-muted-foreground text-xs line-through">
              ₹{product.comparePrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Stock */}
        <span className={`text-2xs font-medium px-2 py-0.5 rounded-full self-start ${stockLabel.cls}`}>
          {stockLabel.text}
        </span>

        {/* CTA */}
        <Link
          href={`/store/${product.id}`}
          className="mt-auto block text-center text-xs font-semibold text-teal border border-teal rounded-lg py-2 min-h-[44px] flex items-center justify-center hover:bg-teal/5 transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
