import { cn } from '@/lib/utils';

/** Open shopping bag with a sparkle; handle gold-accented. */
export function NoProductsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M36 46h48l-5 44H41z" />
        <path d="M46 58v-6M74 58v-6" />
      </g>
      <g className="text-gold" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M48 46v-8a12 12 0 0 1 24 0v8" />
        <path d="M60 24v-4M90 34l3-3M30 34l-3-3" />
      </g>
    </svg>
  );
}
