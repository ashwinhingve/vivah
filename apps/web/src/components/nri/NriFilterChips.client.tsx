'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/lib/countries';
import { RESIDENCY_STATUS_LABELS } from '@smartshaadi/types';

/**
 * Countries shown before the user expands the list — the corridors that actually
 * carry Indian-diaspora volume (Gulf, Anglosphere, Singapore/Malaysia).
 * Not a ranking of importance; just what keeps the default view usable at 360px.
 */
const PRIMARY_CORRIDORS: readonly string[] = [
  'US', 'CA', 'GB', 'AE', 'AU', 'SG', 'NZ', 'QA', 'SA', 'MY',
];

interface NriFilterChipsProps {
  selectedCountries: string[];
  selectedResidencies: string[];
  includeNriOnly: boolean;
  onCountryToggle: (code: string) => void;
  onResidencyToggle: (status: string) => void;
  onNriOnlyToggle: (value: boolean) => void;
  /** Show the residency-status chips. Off until the feed facet supports them. */
  showResidency?: boolean;
  /** Show the "NRI only" checkbox. Off on views that are already NRI-only. */
  showNriOnlyToggle?: boolean;
  className?: string;
}

export function NriFilterChips({
  selectedCountries,
  selectedResidencies,
  includeNriOnly,
  onCountryToggle,
  onResidencyToggle,
  onNriOnlyToggle,
  showResidency = false,
  showNriOnlyToggle = true,
  className,
}: NriFilterChipsProps) {
  const t = useTranslations('nri.filters');
  const [expanded, setExpanded] = useState(false);

  // Rendering all ~40 countries as a flat chip wall filled the entire 375px
  // viewport and pushed the actual results below the fold — the browser check
  // caught what type-check, tests and `next build` all passed. Lead with the
  // corridors that carry real Indian-diaspora volume; the rest stay one tap away.
  // Anything already selected is always shown, so collapsing can never hide an
  // active filter and leave the user unable to clear it.
  const visibleCountries = expanded
    ? COUNTRIES
    : COUNTRIES.filter(
        (c) => PRIMARY_CORRIDORS.includes(c.code) || selectedCountries.includes(c.code),
      );

  return (
    <div className={cn('space-y-3', className)}>
      {/* NRI Only Toggle — hidden on views that are inherently NRI-only, where a
          toggle the user could switch OFF would contradict the page it sits on. */}
      {showNriOnlyToggle && (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('options')}
        </h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeNriOnly}
            onChange={(e) => onNriOnlyToggle(e.target.checked)}
            className="accent-teal"
          />
          <span className="text-sm text-foreground">
            {t('nriOnly')}
          </span>
        </label>
      </div>
      )}

      {/* Country Filters */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('countries')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {visibleCountries.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => onCountryToggle(country.code)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                selectedCountries.includes(country.code)
                  ? 'bg-teal text-white'
                  : 'border border-border bg-surface text-foreground hover:border-teal hover:text-teal'
              )}
            >
              {country.name}
              {selectedCountries.includes(country.code) && (
                <X className="h-3 w-3 ml-0.5" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        {COUNTRIES.length > visibleCountries.length || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex min-h-[44px] items-center text-xs font-semibold text-teal underline-offset-2 hover:underline"
            aria-expanded={expanded}
          >
            {expanded
              ? t('showFewerCountries')
              : t('showAllCountries', { count: COUNTRIES.length - visibleCountries.length })}
          </button>
        ) : null}
      </div>

      {/* Residency Status Filters — rendered only when the caller opts in.
          The feed facet currently supports nriOnly + countries; residency has no
          backing filter yet, and a chip that visibly toggles while changing
          nothing is worse than an absent one. Flip `showResidency` on once the
          API supports it. */}
      {showResidency && (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('residencyStatuses')}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(RESIDENCY_STATUS_LABELS).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => onResidencyToggle(code)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                selectedResidencies.includes(code)
                  ? 'bg-gold/70 text-white'
                  : 'border border-border bg-surface text-foreground hover:border-gold/50 hover:text-gold-muted'
              )}
            >
              {label}
              {selectedResidencies.includes(code) && (
                <X className="h-3 w-3 ml-0.5" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
