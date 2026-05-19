'use client';

/**
 * MatchFilters — sidebar / sheet filter panel for the discovery feed.
 *
 * IMPORTANT: ALL filtering is client-side over already-loaded feed items.
 * There is NO feed-filter API or server-side attribute filter endpoint.
 * The matchmaking/feed route accepts only `page` and `limit` — any additional
 * query params are ignored by the API. Filtering happens entirely in the
 * browser over the items returned by the current page load.
 */

import { useCallback } from 'react';
import { X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

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

// ─── Static option lists ─────────────────────────────────────────────────────

const DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Veg' },
  { value: 'non_vegetarian', label: 'Non-Veg' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'jain', label: 'Jain' },
] as const;

const MUST_HAVE_OPTIONS: { value: MustHave; label: string }[] = [
  { value: 'verified', label: 'Aadhaar Verified' },
  { value: 'withPhoto', label: 'Has Photo' },
  { value: 'highGuna', label: 'High Guna (24+)' },
  { value: 'recentlyActive', label: 'Recently Active' },
];

const MANGLIK_OPTIONS = [
  { value: 'ANY' as const, label: 'Any' },
  { value: 'MANGLIK' as const, label: 'Manglik' },
  { value: 'NON_MANGLIK' as const, label: 'Non-Manglik' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-[44px] cursor-pointer items-center rounded-full border px-3 text-xs font-semibold transition-all duration-100',
        active
          ? 'border-teal bg-teal/10 text-teal'
          : 'border-border bg-surface text-muted-foreground hover:border-teal/50 hover:text-primary'
      )}
    >
      {label}
    </button>
  );
}

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

// ─── Main MatchFilters component ──────────────────────────────────────────────

interface MatchFiltersProps {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  /** Unique cities from currently loaded feed items */
  availableCities?: string[];
  onApply?: () => void;
}

export function MatchFilters({ filters, onChange, availableCities = [], onApply }: MatchFiltersProps) {
  const toggle = useCallback(
    (key: 'cities' | 'religions' | 'educations' | 'diets' | 'mustHaves', value: string) => {
      // Each of these keys holds a string[] or MustHave[] (which extends string[]).
      // We read as readonly string[], toggle, and write back — TypeScript is
      // satisfied via explicit indexing.
      const arr = filters[key] as readonly string[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      onChange({ ...filters, [key]: next });
    },
    [filters, onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <Accordion type="multiple" defaultValue={['age', 'city', 'must-haves']} className="w-full">
        {/* Age range */}
        <AccordionItem value="age">
          <AccordionTrigger className="text-sm font-semibold">Age Range</AccordionTrigger>
          <AccordionContent>
            <div className="px-1 pb-2 pt-1">
              <Slider
                min={18}
                max={60}
                step={1}
                value={filters.ageRange}
                onValueChange={(val) => onChange({ ...filters, ageRange: val as [number, number] })}
                aria-label="Age range"
              />
              <div className="mt-1 flex justify-between text-xs font-semibold text-teal">
                <span>{filters.ageRange[0]} yrs</span>
                <span>{filters.ageRange[1]} yrs</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* City */}
        {availableCities.length > 0 && (
          <AccordionItem value="city">
            <AccordionTrigger className="text-sm font-semibold">City</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2 pb-3 pt-1">
                {availableCities.map((city) => (
                  <ChipToggle
                    key={city}
                    label={city}
                    active={filters.cities.includes(city)}
                    onClick={() => toggle('cities', city)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Diet */}
        <AccordionItem value="diet">
          <AccordionTrigger className="text-sm font-semibold">Diet</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2 pb-3 pt-1">
              {DIET_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  active={filters.diets.includes(opt.value)}
                  onClick={() => toggle('diets', opt.value)}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Manglik */}
        <AccordionItem value="manglik">
          <AccordionTrigger className="text-sm font-semibold">Manglik</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2 pb-3 pt-1">
              {MANGLIK_OPTIONS.map((opt) => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  active={filters.manglikFilter === opt.value}
                  onClick={() => onChange({ ...filters, manglikFilter: opt.value })}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Must-haves */}
        <AccordionItem value="must-haves" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold">Must-Haves</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2 pb-3 pt-1">
              {MUST_HAVE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-muted/60"
                >
                  <span
                    role="checkbox"
                    aria-checked={filters.mustHaves.includes(opt.value)}
                    onClick={() => toggle('mustHaves', opt.value)}
                    className={cn(
                      'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-colors',
                      filters.mustHaves.includes(opt.value)
                        ? 'border-teal bg-teal text-white'
                        : 'border-border bg-surface'
                    )}
                  >
                    {filters.mustHaves.includes(opt.value) && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Apply + Reset */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onApply}
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Reset all filters"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
