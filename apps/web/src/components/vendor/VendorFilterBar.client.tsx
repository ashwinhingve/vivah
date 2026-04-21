'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const CATEGORIES = [
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'CATERING', 'DECORATION', 'VENUE',
  'MAKEUP', 'JEWELLERY', 'CLOTHING', 'MUSIC', 'LIGHTING',
  'SECURITY', 'TRANSPORT', 'PRIEST', 'SOUND', 'EVENT_HOSTING',
  'RENTAL', 'OTHER',
] as const;

export function VendorFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get('category') ?? '';
  const currentCity     = searchParams.get('city') ?? '';

  function apply(category: string, city: string) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (city)     params.set('city', city);
    startTransition(() => {
      router.push(`/vendors?${params.toString()}`);
    });
  }

  return (
    <form
      className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply(fd.get('category') as string, fd.get('city') as string);
      }}
    >
      <div className="flex-1">
        <label htmlFor="vendor-category" className="block text-xs font-medium text-muted-foreground mb-1">
          Category
        </label>
        <select
          id="vendor-category"
          name="category"
          defaultValue={currentCategory}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-teal"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="vendor-city" className="block text-xs font-medium text-muted-foreground mb-1">
          City
        </label>
        <input
          id="vendor-city"
          name="city"
          type="text"
          placeholder="e.g. Mumbai, Delhi"
          defaultValue={currentCity}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] px-5 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
      >
        {isPending ? 'Searching…' : 'Search'}
      </button>

      {(currentCategory || currentCity) && (
        <button
          type="button"
          onClick={() => apply('', '')}
          className="min-h-[44px] px-4 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:bg-surface-muted transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  );
}
