'use client';

/**
 * FeedPageClient — thin client wrapper that holds shared filter state.
 *
 * This lets the desktop sidebar and the MatchFeed (which has a mobile sheet)
 * share the same FeedFilters state without prop-drilling through the server
 * component. The actual filtering happens inside MatchFeed (client-side over
 * loaded items — no server filter API exists).
 */

import { useState } from 'react';
import type { MatchFeedItem } from '@smartshaadi/types';
import { MatchFeed } from '@/components/match/MatchFeed.client';
import { DesktopFilterSidebar } from './DesktopFilterSidebar.client';
import { DEFAULT_FILTERS, type FeedFilters } from '@/components/match/MatchFilters.client';
import { QuotaIndicator } from '@/components/match/QuotaIndicator.client';
import { clientEnv } from '@/lib/env';

type MaritalStatusValue = 'NEVER_MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED';

interface FeedPageClientProps {
  initialItems: MatchFeedItem[];
  total: number;
  maritalPrefs: MaritalStatusValue[];
  availableCities: string[];
  quota?: { remaining: number; limit: number } | null;
  tier?: 'FREE' | 'STANDARD' | 'PREMIUM';
}

export function FeedPageClient({ initialItems, total, maritalPrefs, availableCities, quota, tier = 'FREE' }: FeedPageClientProps) {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  return (
    <div className="flex gap-6">
      {/* Desktop sidebar — hidden on mobile */}
      <DesktopFilterSidebar
        maritalPrefs={maritalPrefs}
        filters={filters}
        onFiltersChange={setFilters}
        availableCities={availableCities}
      />

      {/* Main feed column */}
      <div className="min-w-0 flex-1 space-y-5">
        {/* Quota indicator — only show if enabled and quota data available */}
        {clientEnv.VIEW_QUOTA_ENABLED && quota && (
          <QuotaIndicator
            remaining={quota.remaining}
            limit={quota.limit}
            tier={tier}
            isExhausted={quota.remaining <= 0}
          />
        )}

        <MatchFeed
          initialItems={initialItems}
          total={total}
          externalFilters={filters}
          onExternalFiltersChange={setFilters}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterOpenChange={setMobileFilterOpen}
          availableCities={availableCities}
        />
      </div>
    </div>
  );
}
