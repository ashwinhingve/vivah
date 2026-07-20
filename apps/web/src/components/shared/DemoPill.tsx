'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Floating demo-mode pill with mock credentials.
 * Renders only when NEXT_PUBLIC_DEMO_MODE === 'true'.
 *
 * The wrapper is pointer-events-none so the pill never blocks taps on
 * content underneath (chat composer, feed filters); only the pill itself
 * and its dismiss button are interactive. Dismissal lasts for the session.
 */
export function DemoPill() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem('demo-pill-dismissed') === '1');
  }, []);

  if (process.env['NEXT_PUBLIC_DEMO_MODE'] !== 'true' || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[60] flex justify-center md:inset-x-auto md:bottom-5 md:left-5 md:justify-start">
      <div
        role="note"
        aria-label="Demo mode active"
        className="pointer-events-auto flex max-w-[20rem] items-center rounded-full border border-gold/60 bg-background/95 px-3 py-1.5 text-2xs text-foreground opacity-90 shadow-lg backdrop-blur md:text-xs"
      >
        <span className="font-semibold tracking-wide text-primary">DEMO</span>
        <span className="mx-1.5 text-gold">·</span>
        <span>OTP <code className="font-mono">123456</code></span>
        <span className="mx-1.5 text-gold">·</span>
        <span>Card <code className="font-mono">4111{' '}1111</code></span>
        <button
          type="button"
          aria-label="Dismiss demo banner"
          className="ml-2 -mr-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-gold/15 hover:text-foreground"
          onClick={() => {
            sessionStorage.setItem('demo-pill-dismissed', '1');
            setDismissed(true);
          }}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
