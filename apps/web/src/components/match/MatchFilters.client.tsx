'use client';

/**
 * MatchFilters — lightweight shared exports for the discovery feed.
 *
 * The heavy panel UI (Accordion + Slider) lives in MatchFiltersPanel.client.tsx
 * so consumers can `next/dynamic`-import it with `ssr: false`. This file
 * stays small (types, defaults, option constants, ActiveFilterChips) so
 * those eager imports don't drag the panel into the initial bundle.
 *
 * IMPORTANT: ALL filtering is client-side over already-loaded feed items.
 * There is NO feed-filter API or server-side attribute filter endpoint.
 * The matchmaking/feed route accepts only `page` and `limit` — any additional
 * query params are ignored by the API. Filtering happens entirely in the
 * browser over the items returned by the current page load.
 */

import { X, RotateCcw, SlidersHorizontal } from 'lucide-react';

// ─── Filter State ────────────────────────────────────────────────────────────

export interface FeedFilters {
  ageRange: [number, number];
  cities: string[];
  religions: string[];
  educations: string[];
  diets: string[];
  manglikFilter: 'ANY' | 'MANGLIK' | 'NON_MANGLIK';
  mustHaves: MustHave[];
}

export type MustHave = 'verified' | 'withPhoto' | 'highGuna' | 'recentlyActive';

export const DEFAULT_FILTERS: FeedFilters = {
  ageRange: [21, 50],
  cities: [],
  religions: [],
  educations: [],
  diets: [],
  manglikFilter: 'ANY',
  mustHaves: [],
};

// ─── Shared option lists (also consumed by MatchFiltersPanel) ────────────────

export const DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Veg' },
  { value: 'non_vegetarian', label: 'Non-Veg' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'jain', label: 'Jain' },
] as const;

export const MUST_HAVE_OPTIONS: { value: MustHave; label: string }[] = [
  { value: 'verified', label: 'Aadhaar Verified' },
  { value: 'withPhoto', label: 'Has Photo' },
  { value: 'highGuna', label: 'High Guna (24+)' },
  { value: 'recentlyActive', label: 'Recently Active' },
];

export const MANGLIK_OPTIONS = [
  { value: 'ANY' as const, label: 'Any' },
  { value: 'MANGLIK' as const, label: 'Manglik' },
  { value: 'NON_MANGLIK' as const, label: 'Non-Manglik' },
];

// ─── Active filter chips row ──────────────────────────────────────────────────

export function ActiveFilterChips({
  filters,
  onRemove,
  onReset,
}: {
  filters: FeedFilters;
  onRemove: (key: keyof FeedFilters, value?: string) => void;
  onReset: () => void;
}) {
  const chips: { label: string; onRemove: () => void }[] = [];

  // Age range chip (only if non-default)
  if (filters.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] || filters.ageRange[1] !== DEFAULT_FILTERS.ageRange[1]) {
    chips.push({
      label: `Age ${filters.ageRange[0]}–${filters.ageRange[1]}`,
      onRemove: () => onRemove('ageRange'),
    });
  }
  filters.cities.forEach((c) => chips.push({ label: c, onRemove: () => onRemove('cities', c) }));
  filters.religions.forEach((r) => chips.push({ label: r, onRemove: () => onRemove('religions', r) }));
  filters.educations.forEach((e) => chips.push({ label: e, onRemove: () => onRemove('educations', e) }));
  filters.diets.forEach((d) =>
    chips.push({
      label: DIET_OPTIONS.find((o) => o.value === d)?.label ?? d,
      onRemove: () => onRemove('diets', d),
    })
  );
  if (filters.manglikFilter !== 'ANY') {
    chips.push({
      label: filters.manglikFilter === 'MANGLIK' ? 'Manglik only' : 'Non-Manglik only',
      onRemove: () => onRemove('manglikFilter'),
    });
  }
  filters.mustHaves.forEach((m) =>
    chips.push({
      label: MUST_HAVE_OPTIONS.find((o) => o.value === m)?.label ?? m,
      onRemove: () => onRemove('mustHaves', m),
    })
  );

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-teal/20 bg-teal/5 px-3 py-2"
      aria-label="Active filters"
    >
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-teal/30 bg-surface px-2.5 py-0.5 text-xs font-medium text-teal"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.onRemove}
            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-teal/20"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
      >
        <RotateCcw className="h-3 w-3" />
        Reset all
      </button>
    </div>
  );
}
