'use client';

/**
 * Service filter bar — Phase 8, Unit 8.2.
 *
 * Categories and cities are both passed in from the server, sourced from live
 * database rows. Neither is hardcoded here: adding a category or a city is an
 * admin action, so this component must never contain an India-specific list.
 */

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, SlidersHorizontal } from 'lucide-react';
import type { PostMarriageCategoryWithCount } from '@smartshaadi/types';

interface Props {
  categories: PostMarriageCategoryWithCount[];
  cities: string[];
}

export function ServiceFilters({ categories, cities }: Props) {
  const t = useTranslations('postMarriage.filters');
  const tList = useTranslations('postMarriage.list');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCategory = params.get('category');
  const activeCity = params.get('city') ?? '';
  const activeSort = params.get('sort') ?? 'DEFAULT';

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      // Reset paging — narrowing while on page 3 would show an empty screen.
      next.delete('page');
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  const hasFilters = ['category', 'city', 'priceMin', 'priceMax', 'q']
    .some((k) => params.get(k));

  const chip = (active: boolean) =>
    [
      'inline-flex h-11 items-center rounded-full border px-4 text-sm transition',
      active
        ? 'border-primary bg-primary text-surface'
        : 'border-gold/40 bg-surface text-primary hover:bg-gold/10',
    ].join(' ');

  return (
    <section
      className="mt-6 rounded-2xl border border-gold/25 bg-surface p-4 shadow-card sm:p-6"
      aria-label={t('label')}
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

      <div className="mt-4">
        <h3 className="text-xs uppercase tracking-wide text-gold-muted">{t('category')}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!activeCategory}
            onClick={() => setParam('category', null)}
            className={chip(!activeCategory)}
          >
            {tList('allCategories')}
          </button>
          {categories.map((c) => {
            const active = activeCategory === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={active}
                onClick={() => setParam('category', active ? null : c.slug)}
                className={chip(active)}
              >
                {c.name}
                <span className="ml-1.5 text-xs opacity-70">({c.serviceCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pm-city" className="text-xs uppercase tracking-wide text-gold-muted">
            {t('city')}
          </label>
          <select
            id="pm-city"
            value={activeCity}
            onChange={(e) => setParam('city', e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
          >
            {/* "Anywhere" rather than a blank option: several partners are
                remote-only and have no city, so clearing the filter genuinely
                means anywhere, not "unset". */}
            <option value="">{t('allCities')}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pm-sort" className="text-xs uppercase tracking-wide text-gold-muted">
            {t('sort')}
          </label>
          <select
            id="pm-sort"
            value={activeSort}
            onChange={(e) => setParam('sort', e.currentTarget.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gold/40 bg-background px-3 text-primary focus:border-teal focus:outline-none"
          >
            <option value="DEFAULT">{t('sortOptions.DEFAULT')}</option>
            <option value="PRICE_ASC">{t('sortOptions.PRICE_ASC')}</option>
            <option value="PRICE_DESC">{t('sortOptions.PRICE_DESC')}</option>
          </select>
        </div>
      </div>
    </section>
  );
}
