'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'badge' | 'gauge' | 'bar';

interface CompatibilityScoreProps {
  /** 0–100 compatibility percentage. */
  value: number;
  variant?: Variant;
  /** Gauge diameter in px. Default 80. */
  size?: 80 | 120;
  /** Caption under the gauge / above the bar. Default "Match". */
  label?: string;
  className?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function CompatibilityScore({
  value,
  variant = 'badge',
  size = 80,
  label = 'Match',
  className,
}: CompatibilityScoreProps) {
  const reduce = useReducedMotion();
  const pct = clamp(value);

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal',
          className
        )}
      >
        <span className="font-heading text-sm leading-none">{pct}%</span>
        {label}
      </span>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={cn('w-full', className)}>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </span>
          <span className="font-heading text-sm font-semibold text-primary">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gold/20">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal to-gold"
            initial={{ width: reduce ? `${pct}%` : 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduce ? 0 : 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  // gauge
  const stroke = size === 120 ? 9 : 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className={cn('inline-flex flex-col items-center', className)}
      role="img"
      aria-label={`${pct}% ${label}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gold/25"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="text-teal"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduce ? offset : c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduce ? 0 : 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-heading font-semibold leading-none text-primary',
              size === 120 ? 'text-3xl' : 'text-xl'
            )}
          >
            {pct}%
          </span>
        </div>
      </div>
      <span className="mt-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
    </div>
  );
}
