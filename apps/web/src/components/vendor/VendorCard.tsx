import Link from 'next/link';
import { Star, StarHalf, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import type { VendorProfile } from '@smartshaadi/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        <Star key={`f${i}`} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" />
      ))}
      {half ? <StarHalf className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden="true" /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className="h-3.5 w-3.5 text-border" aria-hidden="true" />
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
    <Card className="group flex flex-col gap-3 border-gold/30 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-base font-semibold leading-snug text-primary">
            {vendor.businessName}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {vendor.city}, {vendor.state}
          </p>
        </div>
        {vendor.verified ? (
          <Badge variant="tealSoft" className="shrink-0">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Verified
          </Badge>
        ) : null}
      </div>

      <Badge variant="default" className="self-start capitalize">
        {vendor.category.replace(/_/g, ' ').toLowerCase()}
      </Badge>

      <div className="flex items-center gap-2">
        <StarRating rating={vendor.rating} />
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{vendor.rating.toFixed(1)}</span>
          {' · '}
          {vendor.totalReviews} review{vendor.totalReviews === 1 ? '' : 's'}
        </span>
      </div>

      {price ? (
        <p className="text-sm">
          <span className="font-semibold text-primary">{price}</span>
          <span className="text-muted-foreground"> starting</span>
        </p>
      ) : null}

      <Button asChild className="mt-auto w-full">
        <Link href={`/vendors/${vendor.id}`}>
          View Profile
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </Button>
    </Card>
  );
}
