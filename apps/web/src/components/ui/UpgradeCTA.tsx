/**
 * Smart Shaadi — UpgradeCTA
 * apps/web/src/components/ui/UpgradeCTA.tsx
 *
 * Standard locked-state overlay for premium-gated features.
 * `blurChildren` mode wraps `children` in a blur + lock overlay.
 * `inline` mode renders a compact upgrade card.
 */

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import type { PremiumTier } from '@smartshaadi/types';
import type { ReactNode } from 'react';

const TIER_LABEL: Record<PremiumTier, string> = {
  FREE: 'Free',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
};

interface BlurProps {
  variant?: 'blur';
  requiredTier: PremiumTier;
  feature: string;
  message?: string;
  children: ReactNode;
}

interface InlineProps {
  variant: 'inline';
  requiredTier: PremiumTier;
  feature: string;
  message?: string;
  children?: never;
}

export function UpgradeCTA(props: BlurProps | InlineProps) {
  const { requiredTier, feature, message } = props;
  const heading = `Unlock ${feature}`;
  const sub = message ?? `Upgrade to ${TIER_LABEL[requiredTier]} to access this feature.`;

  if (props.variant === 'inline') {
    return (
      <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            <Link
              href="/settings/billing"
              className="mt-3 inline-flex items-center rounded-lg bg-[#0A1F4D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1848C8]"
            >
              Upgrade to {TIER_LABEL[requiredTier]}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none filter blur-md">{props.children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-surface/40 backdrop-blur-[2px]">
        <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-center shadow-lg">
          <Lock className="mx-auto h-5 w-5 text-[#0A1F4D]" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">{heading}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          <Link
            href="/settings/billing"
            className="mt-3 inline-flex items-center rounded-lg bg-[#0A1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#1848C8]"
          >
            Upgrade to {TIER_LABEL[requiredTier]}
          </Link>
        </div>
      </div>
    </div>
  );
}
