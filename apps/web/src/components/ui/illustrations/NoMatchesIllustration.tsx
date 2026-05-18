import { cn } from '@/lib/utils';

/** Two profile silhouettes joined by a dotted thread with a gold heart. */
export function NoMatchesIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={30} cy={44} r={11} />
        <path d="M14 78c0-9 7-16 16-16s16 7 16 16" />
        <circle cx={90} cy={44} r={11} />
        <path d="M74 78c0-9 7-16 16-16s16 7 16 16" />
        <path d="M46 56h7M58 56h7M70 56h6" strokeDasharray="0.5 6" />
      </g>
      <path
        className="text-gold"
        d="M60 50c-3-4-9-3-9 2 0 4 5 7 9 10 4-3 9-6 9-10 0-5-6-6-9-2Z"
        fill="currentColor"
      />
    </svg>
  );
}
