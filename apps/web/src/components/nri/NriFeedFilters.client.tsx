'use client';

/**
 * Country filter for the NRI browse view (Phase 7 Sprint G, Unit 7.2 follow-up).
 *
 * The chips component was built during the sprint but never mounted anywhere.
 * This wrapper is what connects it to the page: selection state lives in the
 * URL rather than in React state, so the server component re-fetches the feed
 * with `?countries=…` and the filtered view survives a refresh or a shared link.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { NriFilterChips } from './NriFilterChips.client';

export function NriFeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedCountries =
    searchParams.get('countries')?.split(',').filter(Boolean) ?? [];

  const push = useCallback(
    (countries: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (countries.length > 0) params.set('countries', countries.join(','));
      else params.delete('countries');
      // Drop any stale pagination — a narrowed list has fewer pages, and keeping
      // ?page=4 would land the user on an empty page that looks like no results.
      params.delete('page');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const onCountryToggle = useCallback(
    (code: string) => {
      const next = selectedCountries.includes(code)
        ? selectedCountries.filter((c) => c !== code)
        : [...selectedCountries, code];
      push(next);
    },
    [selectedCountries, push],
  );

  return (
    <div aria-busy={isPending} className={isPending ? 'opacity-60 transition-opacity' : undefined}>
      <NriFilterChips
        selectedCountries={selectedCountries}
        selectedResidencies={[]}
        // This view is inherently NRI-only, so the toggle is fixed on and the
        // control is hidden — an off state here would contradict the page.
        includeNriOnly
        showNriOnlyToggle={false}
        onCountryToggle={onCountryToggle}
        onResidencyToggle={() => undefined}
        onNriOnlyToggle={() => undefined}
      />
    </div>
  );
}
