/**
 * Rentals catalogue page — Server Component
 *
 * ?category= &fromDate= &toDate= &page=
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RentalCard } from '@/components/rental/RentalCard';
import { CategoryTabs } from '@/components/rental/CategoryTabs.client';
import { DateRangePicker } from '@/components/rental/DateRangePicker.client';
import type { RentalItem } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Rent Items — Smart Shaadi',
  description: 'Browse and rent decor, costumes, AV equipment and more for your wedding.',
};

interface PageData {
  items: RentalItem[];
  meta:  { page: number; limit: number; total: number };
}

interface SearchParams {
  category?: string;
  fromDate?: string;
  toDate?:   string;
  page?:     string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style:    'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default async function RentalsPage({ searchParams }: Props) {
  const params   = await searchParams;
  const category = params.category ?? '';
  const fromDate = params.fromDate ?? '';
  const toDate   = params.toDate   ?? '';
  const page     = params.page     ?? '1';

  // Build query string for API
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (fromDate) qs.set('fromDate', fromDate);
  if (toDate)   qs.set('toDate',   toDate);
  qs.set('page',  page);
  qs.set('limit', '12');

  // FIX A4: public GET — no auth cookie needed
  let data: PageData | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/rentals?${qs.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { success: boolean; data: PageData };
      data = json.success ? json.data : null;
    }
  } catch {
    data = null;
  }

  const items      = data?.items   ?? [];
  const totalItems = data?.meta.total ?? 0;
  const totalPages = data ? Math.ceil(totalItems / (data.meta.limit || 12)) : 1;
  const currentPage = parseInt(page, 10);

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#0A1F4D] font-heading">Rent for Your Wedding</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Browse decor, costumes, AV equipment and more
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <Suspense>
            <CategoryTabs current={category} />
          </Suspense>
          <Suspense>
            <DateRangePicker fromDate={fromDate} toDate={toDate} />
          </Suspense>
        </div>

        {/* Results count */}
        {data && (
          <p className="text-xs text-[#64748B]">
            {totalItems === 0
              ? 'No items found'
              : `${totalItems} item${totalItems === 1 ? '' : 's'} available`}
            {fromDate && toDate ? ` · ${fromDate} – ${toDate}` : ''}
          </p>
        )}

        {/* Error state */}
        {!data && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load rental items.</p>
            <p className="text-xs text-destructive mt-1">Please refresh the page or try again later.</p>
          </div>
        )}

        {/* Empty state */}
        {data && items.length === 0 && (
          <div className="rounded-xl border border-[#C5A47E]/30 bg-surface p-8 text-center">
            <p className="text-lg font-semibold text-[#7B2D42]">No items found</p>
            <p className="text-sm text-[#64748B] mt-2">
              {category
                ? `No ${category.toLowerCase()} items available for your selected dates.`
                : 'No items match your filters. Try adjusting the dates or category.'}
            </p>
          </div>
        )}

        {/* Grid */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item) => (
              <RentalCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const pqs = new URLSearchParams(qs.toString());
              pqs.set('page', String(p));
              return (
                <a
                  key={p}
                  href={`/rentals?${pqs.toString()}`}
                  className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-[#7B2D42] text-white'
                      : 'bg-surface border border-[#C5A47E]/40 text-[#64748B] hover:border-[#7B2D42]'
                  }`}
                  aria-current={p === currentPage ? 'page' : undefined}
                >
                  {p}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// suppress unused import warning
void inrFormatter;
