import { cn } from '@/lib/utils';

/** Three abstract storefronts in a row; centre one gold-accented. */
export function NoVendorsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 58h26v30H20zM26 58l4-12h6l-2 12M40 58l-2-12h6l4 12" />
        <path d="M74 58h26v30H74zM80 58l4-12h6l-2 12M94 58l-2-12h6l4 12" />
      </g>
      <g className="text-gold" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M47 54h26v34H47z" />
        <path d="M53 54l4-14h6l-2 14M67 54l-2-14h6l4 14" />
        <path d="M56 88V72h8v16" />
      </g>
    </svg>
  );
}
