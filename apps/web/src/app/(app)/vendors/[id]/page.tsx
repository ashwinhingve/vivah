import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VendorPortfolio, type PortfolioDoc } from '@/components/vendor/VendorPortfolio';
import type { VendorProfile } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type VendorDetail = VendorProfile & { portfolio: PortfolioDoc | null };

interface VendorDetailResponse {
  success: boolean;
  data: VendorDetail;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchVendor(id: string): Promise<VendorDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}`, {
      cache: 'no-store',
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const json = (await res.json()) as VendorDetailResponse;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f${i}`} className="text-amber-400 text-lg">★</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-slate-300 text-lg">★</span>
      ))}
    </span>
  );
}

export default async function VendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vendor = await fetchVendor(id);

  if (!vendor) notFound();

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/vendors" className="hover:text-[#1848C8] transition-colors">
            Vendors
          </Link>
          <span>›</span>
          <span className="text-[#0A1F4D] font-medium truncate">{vendor.businessName}</span>
        </nav>

        {/* Vendor header */}
        <div className="bg-white border border-[#C5A47E]/40 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-[#7B2D42]">{vendor.businessName}</h1>
                {vendor.verified && (
                  <span className="inline-flex items-center gap-1 bg-[#0E7C7B]/10 text-[#0E7C7B] text-xs font-semibold px-2.5 py-1 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>

              <p className="text-slate-500 text-sm mb-3">
                {vendor.city}, {vendor.state}
              </p>

              <span className="inline-block bg-[#0A1F4D]/10 text-[#0A1F4D] text-xs font-medium px-3 py-1 rounded-full mb-4">
                {vendor.category.replace(/_/g, ' ')}
              </span>

              <div className="flex items-center gap-2">
                <StarRating rating={vendor.rating} />
                <span className="text-slate-500 text-sm">
                  {vendor.rating.toFixed(1)} ({vendor.totalReviews} reviews)
                </span>
              </div>
            </div>

            {/* Book Now CTA */}
            <div className="shrink-0">
              <Link
                href={`/bookings/new?vendorId=${vendor.id}`}
                className="block text-center bg-[#0E7C7B] hover:bg-[#149998] text-white font-semibold px-6 py-3 rounded-xl transition-colors min-h-[44px] min-w-[140px] flex items-center justify-center shadow-sm"
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>

        {/* Portfolio */}
        <div className="bg-white border border-[#C5A47E]/30 rounded-2xl p-6 shadow-sm">
          <VendorPortfolio vendor={vendor} />
        </div>
      </div>
    </div>
  );
}
