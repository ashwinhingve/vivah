import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber.client';

interface StatCardProps {
  label: string;
  value: number;
  /** Format the big number (default Indian-grouped integer). */
  format?: (n: number) => string;
  /** Percentage change vs previous period. Positive = up (green). */
  trendPct?: number;
  className?: string;
}

/** Dashboard metric tile. Burgundy count-up number, optional trend chip. */
export function StatCard({ label, value, format, trendPct, className }: StatCardProps) {
  const hasTrend = typeof trendPct === 'number' && trendPct !== 0;
  const up = (trendPct ?? 0) > 0;

  return (
    <div
      className={cn(
        'rounded-2xl border border-gold/20 bg-surface p-6 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover',
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <AnimatedNumber
          value={value}
          format={format}
          className="font-heading text-[32px] font-semibold leading-none text-primary"
        />
        {hasTrend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(trendPct as number)}%
          </span>
        )}
      </div>
    </div>
  );
}
