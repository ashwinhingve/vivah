'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: '',            label: 'All' },
  { value: 'DECOR',       label: 'Decor' },
  { value: 'COSTUME',     label: 'Costume' },
  { value: 'AV_EQUIPMENT',label: 'AV Equipment' },
  { value: 'FURNITURE',   label: 'Furniture' },
  { value: 'LIGHTING',    label: 'Lighting' },
  { value: 'TABLEWARE',   label: 'Tableware' },
  { value: 'OTHER',       label: 'Other' },
] as const;

interface Props {
  current: string;
}

export function CategoryTabs({ current }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    params.delete('page'); // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Filter by category">
      {CATEGORIES.map(({ value, label }) => {
        const active = value === current;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => handleSelect(value)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors min-h-[32px]',
              active
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-muted-foreground border-gold/50 hover:border-primary hover:text-primary'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
