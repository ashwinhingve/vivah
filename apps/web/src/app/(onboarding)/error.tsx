'use client';
import { useEffect } from 'react';

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border shadow-sm p-6 max-w-sm w-full text-center">
        <p className="font-heading text-lg text-primary mb-2">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="w-full bg-teal text-white rounded-lg py-2.5 text-sm font-medium hover:bg-teal-hover transition-colors min-h-[44px]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
