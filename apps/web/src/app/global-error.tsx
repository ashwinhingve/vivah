/* eslint-disable no-restricted-syntax --
 * Root error boundary REPLACES the root layout, so globals.css and the
 * brand-token classes are not guaranteed to be present. Hex is the
 * sanctioned form here (see the JSDoc on GlobalError below).
 */
'use client';

import { useEffect } from 'react';

/**
 * Root error boundary — only renders when the root layout itself throws.
 * It REPLACES the root layout, so app CSS (globals.css) is not guaranteed to be
 * present; brand colours are inlined here intentionally (the one sanctioned
 * place for raw hex — tokens are unavailable at this level).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry/PostHog auto-capture via instrumentation; log for dev visibility.
    console.error('[global-error]', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: '#FEFAF6',
          color: '#2E2E38',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#7B2D42', margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: 360, fontSize: 14, color: '#6B6B76', margin: 0 }}>
          We hit an unexpected error. Please try again — if it keeps happening,
          our team has been notified.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 44,
            padding: '0 20px',
            borderRadius: 8,
            border: 'none',
            background: '#0E7C7B',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
