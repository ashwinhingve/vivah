/**
 * Vendor onboarding — step progress rail (server-safe, presentational).
 * Shared across all six wizard steps so the chrome stays identical.
 */
import { Link } from '@/i18n/navigation';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OnboardingStepKey =
  | 'business' | 'services' | 'portfolio' | 'availability' | 'bank' | 'review';

const STEPS: { key: OnboardingStepKey; label: string }[] = [
  { key: 'business', label: 'Business' },
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'availability', label: 'Availability' },
  { key: 'bank', label: 'Payouts' },
  { key: 'review', label: 'Review' },
];

export function OnboardingStepper({ current }: { current: OnboardingStepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-1">
              <Link
                href={`/vendor/onboarding/${step.key}`}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors sm:text-sm',
                  active && 'bg-primary/10 text-primary',
                  done && 'text-teal hover:bg-teal/5',
                  !active && !done && 'text-text-muted hover:bg-surface',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                    active && 'border-primary bg-primary text-white',
                    done && 'border-teal bg-teal text-white',
                    !active && !done && 'border-border bg-surface text-text-muted',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
