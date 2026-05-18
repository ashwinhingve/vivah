import { cn } from '@/lib/utils';

/** A calendar page with a single gold date marker. */
export function NoBookingsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={26} y={32} width={68} height={58} rx={7} />
        <path d="M26 48h68" />
        <path d="M42 26v12M78 26v12" />
        <path d="M40 62h10M58 62h10M40 76h10" />
      </g>
      <circle cx={75} cy={76} r={7} className="text-gold" fill="currentColor" />
    </svg>
  );
}
