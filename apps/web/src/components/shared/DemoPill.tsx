/**
 * Floating demo-mode pill bottom-right with mock credentials.
 * Renders only when NEXT_PUBLIC_DEMO_MODE === 'true'.
 */
export function DemoPill() {
  if (process.env['NEXT_PUBLIC_DEMO_MODE'] !== 'true') return null;

  return (
    <div
      role="note"
      aria-label="Demo mode active"
      className="fixed bottom-4 right-4 z-[60] max-w-[18rem] rounded-full border border-gold/60 bg-background/95 px-3 py-1.5 text-[11px] text-foreground shadow-lg backdrop-blur sm:bottom-5 sm:right-5 sm:text-xs"
    >
      <span className="font-semibold tracking-wide text-primary">DEMO MODE</span>
      <span className="mx-1.5 text-gold">·</span>
      <span>OTP <code className="font-mono">123456</code></span>
      <span className="mx-1.5 text-gold">·</span>
      <span>Card <code className="font-mono">4111{' '}1111</code></span>
    </div>
  );
}
