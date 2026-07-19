'use client';

/**
 * Browse filter bar — Phase 8, Unit 8.1.
 *
 * Client component because it manipulates the URL. All state lives in the query
 * string rather than in React state, so a filtered view is shareable, the back
 * button behaves, and a reload does not silently reset the filters.
 *
 * The city chips come from the API facet endpoint, which computes them from live
 * rows in the admin-managed city registry's display order. There is no hardcoded
 * list of Indian cities in this file — adding a destination is an admin action,
 * not a code change.
 */

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, SlidersHorizontal } from 'lucide-react';
import type { PremiumPackageFacets, PremiumPackageTier } from '@smartshaadi/types';

interface Props {
  facets: PremiumPackageFacets;
}

export function PackageFilters({ facets }: Props) {
  const t = useTranslations('packages.filters');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCity = params.get('city');
  const activeTier = params.get('tier') as PremiumPackageTier | null;
  const activeSort = params.get('sort') ?? 'DEFAULT';
  const activeCapacity = params.get('capacity') ?? '';

  /**
   * Set or clear one filter. Always resets `page` — staying on page 4 while
   * narrowing to a 2-page result set would land the user on an empty screen
   * that looks like "no results".
   */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      next.delete('page');
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [params, pathname, router],
  );

  const hasFilters = ['city', 'tier', 'capacity', 'priceMin', 'priceMax', 'q']
    .some((k) => params.get(k));

  const chip = (active: boolean) =>
    [
      'inline-flex h-11 items-center rounded-full border px-4 text-sm transition',
      // 44px min touch target is the design-system floor, hence h-11 not h-9.
      active
        ? 'border-primary bg-primary text-surface'
        : 'border-gold/40 bg-surface text-primary hover:bg-gold/10',
    ].join(' ');

  return (
    <section
      className="mt-6 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6"
      aria-label={t('label')}
      // Dims while the server re-renders so a slow filter change reads as
      // "working", not "broken".
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      <div className="flex items-center gap-2 text-gold-muted">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <h2 className="text-sm font-medium uppercase tracking-wide">{t('label')}</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(pathname))}
            className="ml-auto inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm text-teal hover:underline"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t('clearAll')}
          </button>
        )}
      </div>

      {/* Cities */}
      {facets.cities.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-wide text-gold-muted">{t('city')}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {facets.cities.map((c) => {
              const active = activeCity === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam('city', active ? null : c.name)}
                  className={chip(active)}
                >
                  {c.name}
                  <span className="ml-1.5 text-xs opacity-70">({c.packageCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tiers */}
      {facets.tiers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-wide text-gold-muted">{t('tier')}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {facets.tiers.map((tier) => {
              const active = activeTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam('tier', active ? null : tier)}
                  className={chip(active)}
                >
                  {t(`tierName.${tier}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Capacity — ONE number, matched against each package's min/max range.
            Two inputs would let someone describe a range no package satisfies. */}
        <div>
          <label
            htmlFor="capacity"
            className="text-xs uppercase tracking-wide text-gold-muted"
          >
            {t('capacity')}
          </label>
          <input
            id="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={activeCapacity}
            placeholder={t('capacityPlaceholder')}
            // onBlur, not onChange: firing per keystroke would push a history
            // entry and a server round-trip for every digit typed.
            onBlur={(e) => setParam('capacity', e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary placeholder:text-muted focus:border-teal focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="sort" className="text-xs uppercase tracking-wide text-gold-muted">
            {t('sort')}
          </label>
          <select
            id="sort"
            value={activeSort}
            onChange={(e) => setParam('sort', e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
          >
            <option value="DEFAULT">{t('sortOptions.DEFAULT')}</option>
            <option value="PRICE_ASC">{t('sortOptions.PRICE_ASC')}</option>
            <option value="PRICE_DESC">{t('sortOptions.PRICE_DESC')}</option>
            <option value="CAPACITY_DESC">{t('sortOptions.CAPACITY_DESC')}</option>
          </select>
        </div>
      </div>
    </section>
  );
}
