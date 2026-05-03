import type { JSX } from 'react';
import type { MatchExplainer } from '@smartshaadi/types';
import { UpgradeCTA } from '../ui/UpgradeCTA';

interface Props {
  explainer: MatchExplainer | null;
  tier: 'FREE' | 'STANDARD' | 'PREMIUM';
}

export function WhyMatchPanel({ explainer, tier }: Props): JSX.Element | null {
  if (!explainer || (explainer.reasons.length === 0 && !explainer.caveat)) return null;

  const locked = tier === 'FREE';

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-[#0A1F4D]">Why you match</h3>
      <div className={locked ? 'pointer-events-none select-none blur-sm' : ''}>
        <ul className="space-y-1.5">
          {explainer.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-success" />
              {r}
            </li>
          ))}
          {explainer.caveat && (
            <li className="flex items-start gap-2 text-sm text-warning">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
              {explainer.caveat}
            </li>
          )}
        </ul>
      </div>
      {locked && (
        <div className="mt-3">
          <UpgradeCTA
            variant="inline"
            requiredTier="STANDARD"
            feature="Why You Match"
            message="See the top reasons we matched you — upgrade to Standard."
          />
        </div>
      )}
    </section>
  );
}
