'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export function RouteErrorBoundary({ error, reset }: Props) {
  useEffect(() => {
    // Sentry/PostHog auto-capture happens via instrumentation; log for dev visibility
    console.error('[route-error]', { message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <main id="main-content" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <div className="rounded-full bg-warning/10 p-4 text-warning ring-1 ring-amber-200">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="text-2xl font-heading text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message && error.message.length < 200 ? error.message : 'We hit a snag loading this page.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-lg border border-foreground/15 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
