'use client';

/**
 * DesktopFilterSidebar — sticky desktop-only sidebar.
 *
 * Receives filter state and onChange from the parent (MatchFeedPage's client
 * wrapper) so the same filter state drives both the desktop sidebar and the
 * mobile sheet inside MatchFeed.
 *
 * Hidden on mobile — MatchFeed renders the mobile sheet trigger itself.
 */

import { MaritalStatusFilterToggle } from '@/components/feed/MaritalStatusFilterToggle.client';
import { MatchFilters, type FeedFilters } from '@/components/match/MatchFilters.client';

type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface DesktopFilterSidebarProps {
  maritalPrefs: MaritalStatusValue[];
  filters: FeedFilters;
  onFiltersChange: (f: FeedFilters) => void;
  availableCities?: string[];
}

export function DesktopFilterSidebar({ maritalPrefs, filters, onFiltersChange, availableCities = [] }: DesktopFilterSidebarProps) {
  return (
    <aside className="hidden lg:block lg:w-[260px] lg:shrink-0">
      <div className="sticky top-20 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-card">
        <div>
          <h2 className="font-heading text-base font-semibold text-primary">Filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Refine your match feed</p>
        </div>

        {/* Marital status — persisted to server via existing Server Action */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Marital Status
          </p>
          <MaritalStatusFilterToggle initialPrefs={maritalPrefs} />
        </div>

        <hr className="border-border" />

        {/* Attribute filters — ALL client-side over loaded feed items.
            No server-side filter API exists; filtering happens in MatchFeed. */}
        <MatchFilters
          filters={filters}
          onChange={onFiltersChange}
          availableCities={availableCities}
          onApply={() => { /* filter is live on desktop — Apply button only used in mobile sheet */ }}
        />
      </div>
    </aside>
  );
}
