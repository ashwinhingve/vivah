/**
 * Vendor onboarding — step progress rail (server-safe, presentational).
 * Shared across all six wizard steps so the chrome stays identical.
 */
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Check, ArrowLeft } from 'lucide-react';
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
  const pct = ((currentIdx + 1) / STEPS.length) * 100;
  const prevStep = currentIdx > 0 ? STEPS[currentIdx - 1] : undefined;

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

      <div className="mt-3 flex items-center gap-3">
        {prevStep ? (
          <Link
            href={`/vendor/onboarding/${prevStep.key}`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-xs text-text-muted">
            Step {currentIdx + 1} of {STEPS.length}
          </span>
        </div>
      </div>
    </nav>
  );
}

/** Icon-badge card header, shared across onboarding step pages. */
export function OnboardingStepHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal/10">
        <Icon className="h-5 w-5 text-teal" />
      </span>
      <div>
        <h2 className="font-heading text-lg text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
