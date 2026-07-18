'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/lib/countries';
import { RESIDENCY_STATUS_LABELS } from '@smartshaadi/types';

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
          {COUNTRIES.map((country) => (
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
