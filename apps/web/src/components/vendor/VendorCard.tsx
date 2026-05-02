import Link from 'next/link';
import { Star, StarHalf, CheckCircle2, MapPin, ArrowRight, Clock } from 'lucide-react';
import type { VendorProfile } from '@smartshaadi/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from './FavoriteButton.client';

const R2_PUBLIC = process.env['NEXT_PUBLIC_R2_PUBLIC_URL'] ?? '';

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

function priceRange(vendor: VendorProfile): string | null {
  if (vendor.priceMin != null && vendor.priceMax != null) {
    if (vendor.priceMin === vendor.priceMax) return `₹${vendor.priceMin.toLocaleString('en-IN')}`;
    return `₹${vendor.priceMin.toLocaleString('en-IN')} – ₹${vendor.priceMax.toLocaleString('en-IN')}`;
  }
  if (vendor.priceMin != null) return `from ₹${vendor.priceMin.toLocaleString('en-IN')}`;
  const active = vendor.services.filter((s) => s.priceFrom > 0);
  if (active.length === 0) return null;
  const min = Math.min(...active.map((s) => s.priceFrom));
  const max = Math.max(...active.map((s) => s.priceTo ?? s.priceFrom));
  if (min === max) return `₹${min.toLocaleString('en-IN')}`;
  return `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`;
}

function coverUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http')) return key;
  if (R2_PUBLIC) return `${R2_PUBLIC}/${key}`;
  return null;
}

export function VendorCard({ vendor }: VendorCardProps) {
  const price = priceRange(vendor);
  const cover = coverUrl(vendor.coverImageKey);

  return (
    <Card className="group flex flex-col overflow-hidden border-gold/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-primary/10 via-gold/15 to-teal/10">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={vendor.businessName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40 font-heading text-3xl">
            {vendor.businessName.charAt(0)}
          </div>
        )}

        <div className="absolute top-2 right-2">
          <FavoriteButton
            vendorId={vendor.id}
            initialFavorite={vendor.isFavorite ?? false}
            className="h-9 w-9 min-h-0 min-w-0 bg-surface/90 backdrop-blur"
          />
        </div>
        {vendor.verified && (
          <Badge variant="tealSoft" className="absolute top-2 left-2 backdrop-blur bg-surface/90">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Verified
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-base font-semibold leading-snug text-primary line-clamp-1">
          {vendor.businessName}
        </h3>
        {vendor.tagline && (
          <p className="text-xs text-muted-foreground line-clamp-1">{vendor.tagline}</p>
        )}
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {vendor.city}, {vendor.state}
        </p>
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
          </p>
        ) : null}

        {vendor.responseTimeHours != null && vendor.responseTimeHours <= 24 && (
          <p className="inline-flex items-center gap-1 text-xs text-success">
            <Clock className="h-3 w-3" /> Replies in ~{vendor.responseTimeHours}h
          </p>
        )}

        <Button asChild className="mt-auto w-full">
          <Link href={`/vendors/${vendor.id}`}>
            View Profile
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
