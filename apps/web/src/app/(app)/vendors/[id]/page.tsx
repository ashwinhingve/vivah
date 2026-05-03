import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  Star, StarHalf, CheckCircle2, MapPin, Phone, Mail,
  Globe, Instagram, Calendar, Clock, Heart,
} from 'lucide-react';
import type { VendorProfile, VendorReview } from '@smartshaadi/types';
import { VendorPortfolio, type PortfolioDoc } from '@/components/vendor/VendorPortfolio';
import { FavoriteButton } from '@/components/vendor/FavoriteButton.client';
import { InquiryDialog } from '@/components/vendor/InquiryDialog.client';
import { VendorReviews } from '@/components/vendor/VendorReviews.client';
import { AvailabilityCalendar } from '@/components/vendor/AvailabilityCalendar.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const R2_PUBLIC = process.env['NEXT_PUBLIC_R2_PUBLIC_URL'] ?? '';

type VendorDetail = VendorProfile & { portfolio: PortfolioDoc | null };

interface VendorDetailResponse {
  success: boolean;
  data: VendorDetail;
}

interface ReviewsResponse {
  success: boolean;
  data: { reviews: VendorReview[]; total: number };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchVendor(id: string, token: string): Promise<VendorDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}`, {
      cache: 'no-store',
      ...(token ? { headers: { Cookie: `better-auth.session_token=${token}` } } : {}),
    });
    if (res.status === 404 || !res.ok) return null;
    const json = (await res.json()) as VendorDetailResponse;
    return json.success ? json.data : null;
  } catch { return null; }
}

async function fetchReviews(id: string): Promise<{ reviews: VendorReview[]; total: number }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}/reviews?limit=20`, {
      cache: 'no-store',
    });
    if (!res.ok) return { reviews: [], total: 0 };
    const json = (await res.json()) as ReviewsResponse;
    return json.success
      ? { reviews: json.data.reviews ?? [], total: json.data.total ?? 0 }
      : { reviews: [], total: 0 };
  } catch { return { reviews: [], total: 0 }; }
}

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} className="h-4 w-4 fill-amber-400 text-warning/80" aria-hidden="true" />
      ))}
      {half ? <StarHalf className="h-4 w-4 fill-amber-400 text-warning/80" aria-hidden="true" /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} className="h-4 w-4 text-border" aria-hidden="true" />
      ))}
    </span>
  );
}

function coverUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http')) return key;
  if (R2_PUBLIC) return `${R2_PUBLIC}/${key}`;
  return null;
}

export default async function VendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const [vendor, reviewsData] = await Promise.all([
    fetchVendor(id, token),
    fetchReviews(id),
  ]);

  if (!vendor) notFound();

  const cover = coverUrl(vendor.coverImageKey);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/vendors" className="hover:text-teal transition-colors">Vendors</Link>
          <span>›</span>
          <span className="text-foreground font-medium truncate">{vendor.businessName}</span>
        </nav>

        {/* Hero with cover */}
        <div className="relative aspect-[16/7] sm:aspect-[16/6] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-gold/15 to-teal/10 mb-4">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={vendor.businessName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40 font-heading text-6xl">
              {vendor.businessName.charAt(0)}
            </div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <FavoriteButton vendorId={vendor.id} initialFavorite={vendor.isFavorite ?? false} className="bg-surface/90 backdrop-blur" />
          </div>
        </div>

        {/* Header card */}
        <div className="bg-surface border border-gold/40 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-primary font-heading">{vendor.businessName}</h1>
                {vendor.verified && (
                  <span className="inline-flex items-center gap-1 bg-teal/10 text-teal text-xs font-semibold px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>
              {vendor.tagline && (
                <p className="text-sm text-muted-foreground italic mb-2">{vendor.tagline}</p>
              )}
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {vendor.city}, {vendor.state}
              </p>
              <span className="mt-2 inline-block bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full capitalize">
                {vendor.category.replace(/_/g, ' ').toLowerCase()}
              </span>
              <div className="mt-3 flex items-center gap-2">
                <StarRating rating={vendor.rating} />
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{vendor.rating.toFixed(1)}</span>
                  {' · '}{vendor.totalReviews} review{vendor.totalReviews === 1 ? '' : 's'}
                </span>
                {vendor.favoriteCount != null && vendor.favoriteCount > 0 && (
                  <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                    {vendor.favoriteCount}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={`/bookings/new?vendorId=${vendor.id}`}
                className="block text-center bg-teal hover:bg-teal-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors min-h-[44px] flex items-center justify-center shadow-sm"
              >
                Book Now
              </Link>
              <InquiryDialog vendorId={vendor.id} vendorName={vendor.businessName} />
            </div>
          </div>

          {/* Quick facts strip */}
          {(vendor.yearsActive != null || vendor.responseTimeHours != null || (vendor.priceMin != null && vendor.priceMax != null)) && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gold/30 text-sm">
              {vendor.yearsActive != null && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal" />
                  <span><span className="font-semibold">{vendor.yearsActive}+</span> years</span>
                </div>
              )}
              {vendor.responseTimeHours != null && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal" />
                  <span>Replies in <span className="font-semibold">~{vendor.responseTimeHours}h</span></span>
                </div>
              )}
              {vendor.priceMin != null && vendor.priceMax != null && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-muted-foreground">Pricing:</span>
                  <span className="font-semibold text-primary">
                    ₹{vendor.priceMin.toLocaleString('en-IN')} – ₹{vendor.priceMax.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {vendor.description && (
          <div className="bg-surface border border-gold/30 rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-semibold font-heading text-primary mb-2">About</h2>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{vendor.description}</p>
          </div>
        )}

        {/* Contact + availability grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Contact card */}
          <div className="bg-surface border border-gold/30 rounded-2xl p-5">
            <h2 className="text-lg font-semibold font-heading text-primary mb-3">Contact</h2>
            <div className="space-y-2 text-sm">
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-foreground hover:text-teal">
                  <Phone className="h-4 w-4 text-teal" /> {vendor.phone}
                </a>
              )}
              {vendor.email && (
                <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-foreground hover:text-teal">
                  <Mail className="h-4 w-4 text-teal" /> {vendor.email}
                </a>
              )}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-foreground hover:text-teal">
                  <Globe className="h-4 w-4 text-teal" /> {vendor.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {vendor.instagram && (
                <a href={`https://instagram.com/${vendor.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-foreground hover:text-teal">
                  <Instagram className="h-4 w-4 text-teal" /> {vendor.instagram}
                </a>
              )}
              {!vendor.phone && !vendor.email && !vendor.website && !vendor.instagram && (
                <p className="text-sm text-muted-foreground">Use the inquiry button above to reach this vendor.</p>
              )}
            </div>
          </div>

          {/* Availability calendar */}
          <div>
            <p className="text-lg font-semibold font-heading text-primary mb-2 px-1">Availability</p>
            <AvailabilityCalendar vendorId={vendor.id} />
          </div>
        </div>

        {/* Portfolio */}
        <div className="bg-surface border border-gold/30 rounded-2xl p-5 shadow-sm mb-5">
          <VendorPortfolio vendor={vendor} />
        </div>

        {/* Reviews */}
        <div className="bg-surface border border-gold/30 rounded-2xl p-5 shadow-sm mb-5">
          <VendorReviews
            vendorId={vendor.id}
            initial={reviewsData.reviews}
            total={reviewsData.total}
            canReview={!!token}
          />
        </div>
      </div>
    </div>
  );
}
