'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';

const CATEGORIES = [
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE',
  'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING',
  'SECURITY', 'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING',
  'RENTAL', 'OTHER',
] as const;

const SORT_OPTIONS = [
  { value: 'popular',    label: 'Most popular' },
  { value: 'rating',     label: 'Top rated' },
  { value: 'price_low',  label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'recent',     label: 'Recently added' },
] as const;

export function VendorFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const cur = {
    q:        searchParams.get('q')        ?? '',
    category: searchParams.get('category') ?? '',
    city:     searchParams.get('city')     ?? '',
    sort:     searchParams.get('sort')     ?? 'popular',
    priceMin: searchParams.get('priceMin') ?? '',
    priceMax: searchParams.get('priceMax') ?? '',
    minRating: searchParams.get('minRating') ?? '',
    verifiedOnly: searchParams.get('verifiedOnly') === 'true',
  };

  function pushParams(patch: Record<string, string | boolean | undefined | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '' || v === false) params.delete(k);
      else params.set(k, String(v));
    }
    params.delete('page');
    startTransition(() => {
      router.push(`/vendors?${params.toString()}`);
    });
  }

  function applyForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    pushParams({
      q:        (fd.get('q')        as string) || undefined,
      category: (fd.get('category') as string) || undefined,
      city:     (fd.get('city')     as string) || undefined,
      priceMin: (fd.get('priceMin') as string) || undefined,
      priceMax: (fd.get('priceMax') as string) || undefined,
      minRating: (fd.get('minRating') as string) || undefined,
      verifiedOnly: fd.get('verifiedOnly') === 'on',
    });
  }

  const hasActive = !!(
    cur.q || cur.category || cur.city || cur.priceMin || cur.priceMax ||
    cur.minRating || cur.verifiedOnly
  );

  return (
    <form onSubmit={applyForm} className="space-y-3">
      {/* Top row — search + category + sort */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="vendor-q" className="sr-only">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="vendor-q"
              name="q"
              type="search"
              defaultValue={cur.q}
              placeholder="Search by name, city, keyword…"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </div>
        </div>

        <div className="lg:w-44">
          <label htmlFor="vendor-category" className="sr-only">Category</label>
          <select
            id="vendor-category"
            name="category"
            defaultValue={cur.category}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="lg:w-40">
          <label htmlFor="vendor-sort" className="sr-only">Sort</label>
          <select
            id="vendor-sort"
            value={cur.sort}
            onChange={(e) => pushParams({ sort: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="min-h-[44px] px-5 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {isPending ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-pressed={showAdvanced}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-surface px-3 text-sm font-medium hover:bg-gold/10"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="rounded-xl border border-gold/30 bg-background p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="f-city" className="block text-xs font-medium text-muted-foreground mb-1">City</label>
            <input
              id="f-city"
              name="city"
              type="text"
              defaultValue={cur.city}
              placeholder="Mumbai, Delhi…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Price (₹)</label>
            <div className="flex items-center gap-1">
              <input
                name="priceMin"
                type="number"
                min={0}
                placeholder="Min"
                defaultValue={cur.priceMin}
                className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                name="priceMax"
                type="number"
                min={0}
                placeholder="Max"
                defaultValue={cur.priceMax}
                className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="f-rating" className="block text-xs font-medium text-muted-foreground mb-1">Min rating</label>
            <select
              id="f-rating"
              name="minRating"
              defaultValue={cur.minRating}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="3">3.0+</option>
              <option value="3.5">3.5+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="verifiedOnly"
                defaultChecked={cur.verifiedOnly}
                className="h-4 w-4 rounded border-border text-teal focus:ring-teal"
              />
              Verified only
            </label>
          </div>
        </div>
      )}

      {hasActive && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Active filters:</span>
          <button
            type="button"
            onClick={() => pushParams({
              q: undefined, category: undefined, city: undefined,
              priceMin: undefined, priceMax: undefined,
              minRating: undefined, verifiedOnly: false,
            })}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 hover:bg-gold/10"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}
    </form>
  );
}
