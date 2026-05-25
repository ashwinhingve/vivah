import { cn } from '@/lib/utils';

/** A bell with three small "silence" dots above it; gold accent on the clapper. */
export function NoNotificationsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      {/* Bell body */}
      <path
        d="M40 78c-2 0-3-2-2-4l4-7c1-2 2-4 2-6v-8c0-9 7-16 16-16s16 7 16 16v8c0 2 1 4 2 6l4 7c1 2 0 4-2 4H40Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Top knob */}
      <path
        d="M60 33v-4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Clapper / hang loop */}
      <path
        d="M54 82c0 3 3 6 6 6s6-3 6-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Three small "silence" dots above */}
      <circle cx={50} cy={22} r={1.6} className="text-gold" fill="currentColor" />
      <circle cx={60} cy={19} r={1.8} className="text-gold" fill="currentColor" />
      <circle cx={70} cy={22} r={1.6} className="text-gold" fill="currentColor" />
    </svg>
  );
}
