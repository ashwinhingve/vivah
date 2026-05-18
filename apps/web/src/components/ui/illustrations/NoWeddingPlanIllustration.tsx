import { cn } from '@/lib/utils';

/** A mandap silhouette: two pillars + arch, gold arch crown. */
export function NoWeddingPlanIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('text-primary/30', className)}
    >
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 50v42M86 50v42" />
        <path d="M28 92h14M78 92h14" />
        <path d="M31 50h6M83 50h6" />
      </g>
      <g className="text-gold" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 50c0-16 12-26 26-26s26 10 26 26" />
        <path d="M60 24v-8M55 18h10" />
      </g>
      <path
        d="M48 92V70c0-7 5-12 12-12s12 5 12 12v22"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
