import { cn } from '@/lib/utils';

/** A soft chat bubble with three dots; gold accent dot. */
export function NoMessagesIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <path
        d="M26 34c0-5 4-9 9-9h50c5 0 9 4 9 9v34c0 5-4 9-9 9H52l-16 14V77h-1c-5 0-9-4-9-9V34Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={47} cy={51} r={3.5} fill="currentColor" />
      <circle cx={60} cy={51} r={3.5} className="text-gold" fill="currentColor" />
      <circle cx={73} cy={51} r={3.5} fill="currentColor" />
    </svg>
  );
}
