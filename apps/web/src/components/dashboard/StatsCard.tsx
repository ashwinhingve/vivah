import type { LucideIcon } from 'lucide-react';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber.client';

export type StatsVariant = 'default' | 'teal' | 'gold' | 'success' | 'warning';

interface StatsCardProps {
  label: string;
  /** Numeric value drives the count-up; a string skips animation (e.g. for percentages handled by `valuePercent`). */
  value: number | string;
  sub?: string;
  icon?: LucideIcon;
  variant?: StatsVariant;
  delta?: number;
  /** When set, the value is rendered as `{n}%` and animates 0 → value. Overrides `value`. */
  valuePercent?: number;
  /** Animation delay (ms) for the count-up. */
  animDelayMs?: number;
  /** CTA shown only when the metric is zero — keeps empty cards actionable. */
  emptyCta?: { label: string; href: string };
}

const VARIANT_STYLES: Record<StatsVariant, { tile: string; value: string }> = {
  default: { tile: 'from-surface to-surface-muted/70 border-gold/20', value: 'text-primary' },
  teal:    { tile: 'from-surface to-teal/5 border-teal/20',           value: 'text-primary' },
  gold:    { tile: 'from-surface to-gold/10 border-gold/30',          value: 'text-primary' },
  success: { tile: 'from-surface to-success/5 border-success/20',     value: 'text-primary' },
  warning: { tile: 'from-surface to-warning/5 border-warning/20',     value: 'text-primary' },
};

export function StatsCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'default',
  delta,
  valuePercent,
  animDelayMs = 0,
  emptyCta,
}: StatsCardProps) {
  const v = VARIANT_STYLES[variant];
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;

  const numericValue =
    valuePercent != null ? valuePercent : typeof value === 'number' ? value : null;
  const isZero = numericValue === 0;
  const delaySec = animDelayMs / 1000;

  return (
    <div
      className={cn(
        'group relative flex h-32 flex-col gap-1.5 rounded-xl border bg-gradient-to-br p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]',
        v.tile
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <Icon className="h-4 w-4 text-gold/60" aria-hidden="true" />
        ) : null}
      </div>

      <div className="flex flex-1 items-center">
        <div className="flex items-baseline gap-2">
          {numericValue != null ? (
            <AnimatedNumber
              value={numericValue}
              delay={delaySec}
              duration={0.8}
              {...(valuePercent != null ? { format: (n: number) => `${Math.round(n)}%` } : {})}
              className={cn('font-heading text-4xl font-bold leading-none', v.value)}
            />
          ) : (
            <p className={cn('font-heading text-4xl font-bold leading-none', v.value)}>{value}</p>
          )}
          {delta != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                deltaPositive && 'text-success',
                deltaNegative && 'text-destructive',
                !deltaPositive && !deltaNegative && 'text-muted-foreground'
              )}
            >
              {deltaPositive ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : null}
              {deltaNegative ? <TrendingDown className="h-3 w-3" aria-hidden="true" /> : null}
              {deltaPositive ? '+' : ''}
              {delta}%
            </span>
          ) : null}
        </div>
      </div>

      {isZero && emptyCta ? (
        <Link
          href={emptyCta.href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal underline-offset-2 hover:underline"
        >
          {emptyCta.label}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      ) : sub ? (
        <p className="text-[13px] text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}
