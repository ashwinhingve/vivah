'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';

interface OnboardingNavProps {
  currentStep: number;
  totalSteps?: number;
  backHref?: string;
  skipHref?: string;
  saveLabel?: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="ml-auto min-h-[44px] px-6 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function OnboardingNav({
  currentStep,
  totalSteps = 8,
  backHref,
  skipHref,
  saveLabel = 'Save & Continue',
}: OnboardingNavProps) {
  const pct = Math.min(Math.max((currentStep / totalSteps) * 100, 0), 100);

  return (
    <div className="space-y-4 pt-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-teal rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="text-sm font-medium text-primary hover:text-[#5C2031] transition-colors min-h-[44px] inline-flex items-center"
          >
            ← Back
          </Link>
        ) : (
          <span />
        )}
        <SubmitButton label={saveLabel} />
      </div>

      {skipHref && (
        <div className="text-center">
          <Link
            href={skipHref}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Skip for now
          </Link>
        </div>
      )}
    </div>
  );
}
