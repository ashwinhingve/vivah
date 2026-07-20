'use client';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

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
      <div className="bg-surface rounded-2xl border border-gold/20 shadow-card p-6 max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
        </div>
        <p className="font-heading text-lg text-primary mb-2 text-center">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-6 text-center">{error.message}</p>
        <button
          onClick={reset}
          className="w-full bg-teal hover:bg-teal-hover text-white rounded-lg py-3 text-sm font-medium transition-colors min-h-[44px] active:scale-[0.98]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
