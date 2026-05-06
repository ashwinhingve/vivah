'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface BudgetSlice {
  label: string;
  amount: number;
  /** CSS var (e.g. "var(--primary)") or hex string. */
  color: string;
}

interface Props {
  slices: BudgetSlice[];
  totalBudget: number;
  size?: number;
  className?: string;
}

/**
 * Pure-SVG budget donut. Slices animate in via stroke-dasharray.
 * Center label shows percent of budget consumed.
 */
export function BudgetDonut({ slices, totalBudget, size = 200, className }: Props) {
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;

  const totalSpent = slices.reduce((acc, s) => acc + s.amount, 0);
  const usedPct = Math.min(1, totalSpent / Math.max(totalBudget, 1));

  const segments = useMemo(() => {
    let acc = 0;
    return slices.map((s) => {
      const pct = s.amount / Math.max(totalSpent, 1);
      const dash = pct * circumference * usedPct;
      const offset = circumference - acc;
      acc += dash;
      return { ...s, dash, offset };
    });
  }, [slices, totalSpent, circumference, usedPct]);

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:items-center', className)}>
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth="14"
          />
          {segments.map((s, i) => (
            <circle
              key={`${s.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeLinecap="butt"
              strokeDasharray={`${s.dash} ${circumference}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-2">Spent</span>
          <span className="font-heading text-2xl font-bold text-primary">
            {Math.round(usedPct * 100)}%
          </span>
        </div>
      </div>

      <ul className="flex min-w-[180px] flex-col gap-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-fg-1">{s.label}</span>
            </span>
            <span className="tabular-nums text-fg-2">
              {new Intl.NumberFormat('en-IN').format(s.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
