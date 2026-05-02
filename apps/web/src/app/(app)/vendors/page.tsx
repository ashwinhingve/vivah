import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { VendorCard } from '@/components/vendor/VendorCard';
import { VendorFilterBar } from '@/components/vendor/VendorFilterBar.client';
import type { VendorProfile } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PAGE_SIZE = 12;

interface VendorsApiResponse {
  success: boolean;
  data: {
    vendors: VendorProfile[];
    meta: { page: number; total: number; limit: number };
  };
  meta: { timestamp: string };
}

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const FILTER_KEYS = ['q', 'category', 'city', 'state', 'priceMin', 'priceMax', 'minRating', 'verifiedOnly', 'sort'] as const;

async function fetchVendors(
  params: Record<string, string>,
  token: string,
): Promise<{ vendors: VendorProfile[]; total: number; error: boolean }> {
  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = params[k];
    if (v) query.set(k, v);
  }
  query.set('page',  params['page']  ?? '1');
  query.set('limit', String(PAGE_SIZE));

  try {
    const res = await fetch(`${API_URL}/api/v1/vendors?${query.toString()}`, {
      cache: 'no-store',
      ...(token ? { headers: { Cookie: `better-auth.session_token=${token}` } } : {}),
    });
    if (!res.ok) return { vendors: [], total: 0, error: true };
    const json = (await res.json()) as VendorsApiResponse;
    return {
      vendors: json.success ? (json.data?.vendors ?? []) : [],
      total:   json.success ? (json.data?.meta?.total ?? 0) : 0,
      error:   !json.success,
    };
  } catch {
    return { vendors: [], total: 0, error: true };
  }
}

export default async function VendorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const page = Math.max(1, parseInt(params['page'] ?? '1', 10));

  const { vendors, total, error } = await fetchVendors(params as Record<string, string>, token);

  const hasNext = total > page * PAGE_SIZE;
  const hasPrev = page > 1;

  function buildPageHref(p: number) {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params[k];
      if (v) q.set(k, v);
    }
    q.set('page', String(p));
    return `/vendors?${q.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">Find Wedding Vendors</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {total > 0
                ? `${total.toLocaleString('en-IN')} vendor${total === 1 ? '' : 's'} found`
                : 'Discover photographers, caterers, decorators and more.'}
            </p>
          </div>
          <Link
            href="/vendors/favorites"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm font-medium text-primary hover:bg-gold/10"
          >
            ❤ Saved
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 mb-6 shadow-sm">
          <Suspense fallback={<div className="h-10 animate-pulse bg-[#F5EFE8] rounded-lg" />}>
            <VendorFilterBar />
          </Suspense>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Could not load vendors. Please try again.</p>
          </div>
        )}

        {!error && vendors.length === 0 && (
          <div className="bg-surface border border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No vendors found.</p>
            <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters.</p>
          </div>
        )}

        {vendors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {vendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-center gap-3">
            {hasPrev && (
              <Link
                href={buildPageHref(page - 1)}
                className="min-h-[44px] px-5 py-2.5 border border-gold/40 text-foreground text-sm font-medium rounded-lg hover:bg-background transition-colors flex items-center"
              >
                ← Previous
              </Link>
            )}
            <span className="text-muted-foreground text-sm">Page {page}</span>
            {hasNext && (
              <Link
                href={buildPageHref(page + 1)}
                className="min-h-[44px] px-5 py-2.5 bg-teal hover:bg-teal-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
