/**
 * RentalCard — Server Component
 * Displays a single rental item in the catalogue grid.
 */

import Link from 'next/link';
import type { RentalItem } from '@smartshaadi/types';

const CATEGORY_LABELS: Record<string, string> = {
  DECOR:        'Decor',
  COSTUME:      'Costume',
  AV_EQUIPMENT: 'AV Equipment',
  FURNITURE:    'Furniture',
  LIGHTING:     'Lighting',
  TABLEWARE:    'Tableware',
  OTHER:        'Other',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

interface Props {
  item: RentalItem;
}

export function RentalCard({ item }: Props) {
  const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
  const isLimited     = item.stockQty <= 3;

  return (
    <div className="rounded-xl shadow-sm bg-[#FEFAF6] p-4 flex flex-col gap-3">
      {/* Thumbnail placeholder (Phase 2: wire r2ImageKeys[0]) */}
      <div className="w-full aspect-[4/3] rounded-lg bg-[#C5A47E]/20 flex items-center justify-center overflow-hidden">
        {item.imageKeys[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${item.imageKeys[0]}`}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[#C5A47E] text-xs font-medium">No image yet</span>
        )}
      </div>

      {/* Category badge */}
      <span className="inline-flex self-start rounded-full bg-[#C5A47E]/20 text-[#7B2D42] px-2 py-0.5 text-xs uppercase font-medium tracking-wide">
        {categoryLabel}
      </span>

      {/* Name */}
      <h3 className="text-lg font-semibold text-[#7B2D42] leading-snug line-clamp-2">
        {item.name}
      </h3>

      {/* Price */}
      <p className="text-sm font-bold text-[#0F172A]">
        {inrFormatter.format(item.pricePerDay)}
        <span className="font-normal text-[#64748B]">/day</span>
      </p>

      {/* Availability indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isLimited ? 'bg-amber-500' : 'bg-[#0E7C7B]'
          }`}
          aria-hidden="true"
        />
        <span
          className={`text-xs font-medium ${
            isLimited ? 'text-amber-700' : 'text-[#0E7C7B]'
          }`}
        >
          {isLimited ? `Limited (${item.stockQty} left)` : 'Available'}
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/rentals/${item.id}`}
        className="mt-auto flex items-center justify-center min-h-[44px] rounded-lg bg-[#0E7C7B] text-white text-sm font-semibold hover:bg-[#0a5e5d] transition-colors"
      >
        View &amp; Book
      </Link>
    </div>
  );
}
