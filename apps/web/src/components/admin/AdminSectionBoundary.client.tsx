'use client';

import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Human label shown in the fallback + attached as a Sentry tag, e.g. "System Health". */
  section: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Per-section error boundary for the admin dashboard.
 *
 * The admin page fans out to many independent API endpoints and renders them
 * through one shared tree. Without isolation, a single throw (e.g. an API-shape
 * drift causing `undefined.slice()`) bubbles to `admin/error.tsx` and 500s the
 * WHOLE console. Wrapping each section in this boundary contains the blast
 * radius to a single card so the rest of the dashboard keeps working.
 *
 * Reset behaviour: this is a class boundary, so `router.refresh()` (the Refresh
 * button) re-runs the Server Component but does NOT clear a tripped boundary on
 * its own. Callers pass `key={refreshedAt}` so each refresh remounts a fresh
 * boundary and auto-clears a transient failure.
 */
export class AdminSectionBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // This boundary swallows the error before Next's own instrumentation sees
    // it, so log + report to Sentry explicitly (mirrors RouteErrorBoundary).
    console.error('[admin-section-error]', {
      section: this.props.section,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    Sentry.captureException(error, { tags: { adminSection: this.props.section } });
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-surface p-6 text-center">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <p className="text-sm font-semibold text-destructive">This section couldn&apos;t load</p>
          <p className="text-xs text-text-muted">
            {this.props.section} — try refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
