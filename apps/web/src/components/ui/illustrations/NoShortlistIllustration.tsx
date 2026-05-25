import { cn } from '@/lib/utils';

/** A tilted bookmark with a gold corner accent dot. */
export function NoShortlistIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g transform="rotate(-8 60 60)">
        {/* Bookmark outline */}
        <path
          d="M44 28h32a3 3 0 0 1 3 3v60a2 2 0 0 1-3 1.6L60 82l-16 10.6A2 2 0 0 1 41 91V31a3 3 0 0 1 3-3Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Subtle stitch line */}
        <path
          d="M50 40h20"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
      {/* Gold corner accent */}
      <circle cx={84} cy={28} r={3.5} className="text-gold" fill="currentColor" />
    </svg>
  );
}
