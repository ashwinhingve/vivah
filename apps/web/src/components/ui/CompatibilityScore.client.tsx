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
  /** Caption under the gauge / above the bar. Defaults to the score tier. */
  label?: string;
  className?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Compatibility tier label. COMPATIBILITY ONLY (0–100). Do NOT use for Guna
 * Milan — Guna is a fixed 0–36 Vedic scale with its own tiers.
 */
export function getScoreLabel(score: number): string {
  const s = clamp(score);
  if (s >= 85) return 'Excellent match';
  if (s >= 70) return 'Strong match';
  if (s >= 50) return 'Good match';
  if (s >= 30) return 'Fair match';
  return 'Limited compatibility';
}

interface ScoreColor {
  /** Arc / icon stroke (SVG uses currentColor). */
  arc: string;
  /** Contrast-safe text on light bg. */
  text: string;
  /** Soft background for the badge. */
  soft: string;
  /** Bar gradient endpoints (band → next band down for depth). */
  from: string;
  to: string;
}

/**
 * Token-class bundle for a compatibility score's band. Brand tokens only —
 * no raw hex (project rule). gray-400 has no brand token and grays are
 * banned, so the "Limited" band uses the muted/border tokens.
 * COMPATIBILITY ONLY (0–100) — not Guna Milan.
 */
export function getScoreColor(score: number): ScoreColor {
  const s = clamp(score);
  if (s >= 85)
    return { arc: 'text-teal', text: 'text-teal', soft: 'bg-teal/10', from: 'from-teal', to: 'to-teal-hover' };
  if (s >= 70)
    return { arc: 'text-teal-hover', text: 'text-teal-hover', soft: 'bg-teal/10', from: 'from-teal-hover', to: 'to-gold' };
  if (s >= 50)
    return { arc: 'text-gold', text: 'text-gold-muted', soft: 'bg-gold/15', from: 'from-gold', to: 'to-warning' };
  if (s >= 30)
    return { arc: 'text-warning', text: 'text-warning', soft: 'bg-warning/10', from: 'from-warning', to: 'to-gold' };
  return { arc: 'text-text-muted', text: 'text-text-muted', soft: 'bg-text-muted/10', from: 'from-text-muted', to: 'to-border' };
}

export function CompatibilityScore({
  value,
  variant = 'badge',
  size = 80,
  label,
  className,
}: CompatibilityScoreProps) {
  const reduce = useReducedMotion();
  const pct = clamp(value);
  const band = getScoreColor(pct);
  const caption = label ?? getScoreLabel(pct);

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
          band.soft,
          band.text,
          className
        )}
      >
        <span className="font-heading text-sm leading-none">{pct}%</span>
        {caption}
      </span>
    );
  }

  if (variant === 'bar') {
    return (
      <div className={cn('w-full', className)}>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {caption}
          </span>
          <span className={cn('font-heading text-sm font-semibold', band.text)}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gold/20">
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', band.from, band.to)}
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
      aria-label={`${pct}% — ${caption}`}
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
            className={band.arc}
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
        {caption}
      </span>
    </div>
  );
}
