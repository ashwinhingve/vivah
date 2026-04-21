import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatsVariant = 'default' | 'teal' | 'gold' | 'success' | 'warning';

interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  variant?: StatsVariant;
  delta?: number;
}

const VARIANT_STYLES: Record<StatsVariant, { tile: string; icon: string; value: string }> = {
  default: {
    tile:  'from-surface to-surface-muted/70 border-border',
    icon:  'bg-muted text-muted-foreground',
    value: 'text-foreground',
  },
  teal: {
    tile:  'from-surface to-teal/5 border-teal/20',
    icon:  'bg-teal/10 text-teal',
    value: 'text-teal',
  },
  gold: {
    tile:  'from-surface to-gold/10 border-gold/30',
    icon:  'bg-gold/15 text-gold-muted',
    value: 'text-primary',
  },
  success: {
    tile:  'from-surface to-success/5 border-success/20',
    icon:  'bg-success/10 text-success',
    value: 'text-success',
  },
  warning: {
    tile:  'from-surface to-warning/5 border-warning/20',
    icon:  'bg-warning/10 text-warning',
    value: 'text-warning',
  },
};

export function StatsCard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'default',
  delta,
}: StatsCardProps) {
  const v = VARIANT_STYLES[variant];
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-gradient-to-br p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]',
        v.tile
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', v.icon)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-2">
        <p className={cn('font-heading text-3xl font-bold leading-none', v.value)}>{value}</p>
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

      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
