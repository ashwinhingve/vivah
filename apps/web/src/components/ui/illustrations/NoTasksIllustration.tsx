import { cn } from '@/lib/utils';

/** A clipboard checklist with three lines; one gold checkmark. */
export function NoTasksIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={30} y={30} width={60} height={62} rx={7} />
        <path d="M48 30v-4c0-3 2-5 5-5h14c3 0 5 2 5 5v4" />
        <rect x={42} y={48} width={9} height={9} rx={2.5} />
        <rect x={42} y={68} width={9} height={9} rx={2.5} />
        <path d="M58 52h20M58 72h20" />
      </g>
      <path
        className="text-gold"
        d="M44 52.5l2.5 2.5 4-5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
