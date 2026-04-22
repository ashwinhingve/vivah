'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['All', 'Gifts', 'Trousseau', 'Ethnic Wear', 'Pooja', 'Decor', 'Stationery', 'Other'] as const;

interface StoreCategoryFilterProps {
  activeCategory: string;
  searchQuery: string;
}

export function StoreCategoryFilter({ activeCategory, searchQuery }: StoreCategoryFilterProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'All') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
        <input
          type="search"
          placeholder="Search products..."
          defaultValue={searchQuery}
          onChange={e => updateParam('search', e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#C5A47E]/30 rounded-lg outline-none focus:ring-2 focus:ring-[#0E7C7B]/30 focus:border-[#0E7C7B] transition-colors min-h-[44px]"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => updateParam('category', cat)}
            className={cn(
              'flex-shrink-0 text-xs font-medium px-3 py-2 rounded-lg min-h-[36px] transition-colors whitespace-nowrap',
              activeCategory === cat || (cat === 'All' && !activeCategory)
                ? 'bg-[#0E7C7B] text-white'
                : 'bg-white border border-[#C5A47E]/30 text-[#64748B] hover:border-[#0E7C7B]/50 hover:text-[#0E7C7B]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
