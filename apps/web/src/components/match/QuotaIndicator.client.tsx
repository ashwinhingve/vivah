'use client';

/**
 * Smart Shaadi — Match View Quota Indicator
 * apps/web/src/components/match/QuotaIndicator.client.tsx
 *
 * Displays remaining daily match views (FREE tier: 5/day).
 * Shows upgrade CTA when quota exhausted or near limit.
 *
 * Design: Tokens only (bg-primary, text-teal, border-gold, etc.)
 * Responsive: 360px mobile, 44px+ touch targets.
 */

import { useTranslations } from 'next-intl';
import { AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

interface QuotaIndicatorProps {
  remaining: number;
  limit: number;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
  isExhausted: boolean;
}

export function QuotaIndicator({ remaining, limit, tier, isExhausted }: QuotaIndicatorProps) {
  const t = useTranslations();
  const i18n = useTranslations('quota');

  // PREMIUM/STANDARD: no quota shown
  if (!Number.isFinite(limit)) {
    return null;
  }

  // Calculate usage percentage
  const percentUsed = Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100));
  const isNearLimit = remaining <= 2;

  if (isExhausted) {
    return (
      <div className="rounded-2xl border-2 border-gold bg-background p-4 sm:p-6">
        <div className="flex gap-3 sm:gap-4">
          <AlertCircle className="h-6 w-6 flex-shrink-0 text-teal" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-heading text-lg font-semibold text-primary sm:text-xl">
              {i18n('exhausted')}
            </h3>
            <p className="mt-1 text-sm text-gold-muted sm:text-base">
              {tier === 'FREE' ? i18n('exhaustedFree') : i18n('refreshTip')}
            </p>

            {/* Upgrade CTA button */}
            {tier === 'FREE' && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/settings/billing" className="flex-1">
                  <Button
                    size="lg"
                    className="w-full bg-primary text-background hover:bg-primary/90"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    {i18n('upgradeCTA')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show remaining views indicator
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-6 ${isNearLimit ? 'border-gold bg-background' : 'border-teal/20 bg-background/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gold-muted sm:text-base">
            {i18n('title')}
          </p>
          <p className="mt-2 text-base font-semibold text-primary sm:text-lg">
            {remaining} / {limit} {t('common.views')}
          </p>
          {isNearLimit && (
            <p className="mt-1 text-xs text-teal sm:text-sm">
              {i18n('premiumBenefit')}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="ml-4 w-12 sm:w-16">
          <div className="relative h-2 w-full overflow-hidden rounded-full border border-teal/30 bg-background">
            <div
              className={`h-full transition-all duration-300 ${
                isNearLimit ? 'bg-gold' : 'bg-teal'
              }`}
              style={{ width: `${percentUsed}%` }}
              role="progressbar"
              aria-valuenow={limit - remaining}
              aria-valuemin={0}
              aria-valuemax={limit}
            />
          </div>
          <p className="mt-1 text-center text-xs text-gold-muted font-medium">
            {percentUsed.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Upgrade prompt when nearing limit */}
      {isNearLimit && tier === 'FREE' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-teal/40 bg-teal/5 p-3">
          <Zap className="h-4 w-4 flex-shrink-0 text-teal" aria-hidden="true" />
          <span className="flex-1 text-xs text-teal sm:text-sm">
            {i18n('premiumBenefit')}
          </span>
          <Link href="/settings/billing" className="flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-teal hover:bg-teal/10">
              {i18n('upgradeCTA')}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
