import { cn } from '@/lib/utils';

/** Three circles connected by dotted lines with one faded — offline / network-down motif. */
export function NoNetworkIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      {/* Two active circles + one faded */}
      <circle cx={28} cy={48} r={9} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={92} cy={48} r={9} stroke="currentColor" strokeWidth={1.5} className="opacity-40" />
      <circle cx={60} cy={84} r={9} stroke="currentColor" strokeWidth={1.5} />

      {/* Dotted lines between them */}
      <path
        d="M37 48h46"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="2 4"
      />
      <path
        d="M34 56l22 22"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="2 4"
      />
      <path
        d="M86 56l-22 22"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="2 4"
        className="opacity-40"
      />

      {/* Active gold accent */}
      <circle cx={28} cy={48} r={2.2} className="text-gold" fill="currentColor" />
      <circle cx={60} cy={84} r={2.2} className="text-gold" fill="currentColor" />
    </svg>
  );
}
