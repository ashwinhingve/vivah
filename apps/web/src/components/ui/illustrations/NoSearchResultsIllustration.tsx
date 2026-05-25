import { cn } from '@/lib/utils';

/** A magnifying glass with a small question-mark glyph inside the lens; gold accent on the handle. */
export function NoSearchResultsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      {/* Lens */}
      <circle
        cx={52}
        cy={52}
        r={22}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {/* Handle */}
      <path
        d="M70 70l22 22"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Question mark in the lens */}
      <path
        d="M47 47c0-3 2-5 5-5s5 2 5 5c0 2-1 3-3 4-2 1-2 2-2 4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={52} cy={59} r={1.6} fill="currentColor" />
      {/* Gold accent on handle tip */}
      <circle cx={93} cy={93} r={3} className="text-gold" fill="currentColor" />
    </svg>
  );
}
