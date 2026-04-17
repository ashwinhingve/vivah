import Link from 'next/link';
import type { VendorProfile } from '@smartshaadi/types';

interface VendorCardProps {
  vendor: VendorProfile;
}

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} className="text-amber-400 text-sm">★</span>
      ))}
      {half && <span className="text-amber-400 text-sm">½</span>}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-slate-300 text-sm">★</span>
      ))}
    </span>
  );
}

function priceRange(services: VendorProfile['services']): string | null {
  const active = services.filter((s) => s.priceFrom > 0);
  if (active.length === 0) return null;
  const min = Math.min(...active.map((s) => s.priceFrom));
  const max = Math.max(...active.map((s) => s.priceTo ?? s.priceFrom));
  if (min === max) return `₹${min.toLocaleString('en-IN')}`;
  return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
}

export function VendorCard({ vendor }: VendorCardProps) {
  const price = priceRange(vendor.services);

  return (
    <article className="bg-[#FEFAF6] border border-[#C5A47E]/30 rounded-xl shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#7B2D42] text-base leading-snug truncate">
            {vendor.businessName}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            {vendor.city}, {vendor.state}
          </p>
        </div>

        {vendor.verified && (
          <span className="shrink-0 inline-flex items-center gap-1 bg-[#0E7C7B]/10 text-[#0E7C7B] text-xs font-medium px-2 py-0.5 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        )}
      </div>

      {/* Category badge */}
      <div>
        <span className="inline-block bg-[#0A1F4D]/10 text-[#0A1F4D] text-xs font-medium px-2.5 py-0.5 rounded-full">
          {vendor.category.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <StarRating rating={vendor.rating} />
        <span className="text-slate-500 text-xs">
          {vendor.rating.toFixed(1)} ({vendor.totalReviews} reviews)
        </span>
      </div>

      {/* Price range */}
      {price && (
        <p className="text-[#0A1F4D] text-sm font-medium">{price}</p>
      )}

      {/* CTA */}
      <Link
        href={`/vendors/${vendor.id}`}
        className="mt-auto block text-center bg-[#1848C8] hover:bg-[#0A1F4D] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px] flex items-center justify-center"
      >
        View Profile
      </Link>
    </article>
  );
}
