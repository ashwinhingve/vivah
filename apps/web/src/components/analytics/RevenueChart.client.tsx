'use client';

import type { RevenueMonth } from './types';

const W = 720;
const H = 240;
const PAD_X = 44;
const PAD_Y = 24;

const BANDS = [
  { key: 'standard_m' as const, label: 'Standard M', color: 'var(--color-primary)' },
  { key: 'standard_y' as const, label: 'Standard Y', color: 'var(--color-teal)' },
  { key: 'premium_m' as const, label: 'Premium M', color: 'var(--color-gold)' },
  { key: 'premium_y' as const, label: 'Premium Y', color: 'var(--color-gold-muted)' },
];

function inr(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {children}
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenueMonth[] | null }) {
  const grand =
    data?.reduce(
      (s, m) => s + m.standard_m + m.standard_y + m.premium_m + m.premium_y,
      0,
    ) ?? 0;

  if (!data || data.length === 0 || grand === 0) {
    return (
      <ChartShell>
        <div className="flex h-44 flex-col items-center justify-center gap-1 text-center text-sm text-text-muted">
          <span>No subscription revenue recorded for this period.</span>
          <span className="text-xs">Populates once live subscription charges land.</span>
        </div>
      </ChartShell>
    );
  }

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const maxTotal = Math.max(
    ...data.map((m) => m.standard_m + m.standard_y + m.premium_m + m.premium_y),
    1,
  );
  const x = (i: number): number =>
    PAD_X + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number): number => PAD_Y + innerH - (v / maxTotal) * innerH;

  const lower = data.map(() => 0);

  return (
    <ChartShell>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        {BANDS.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="ml-auto font-semibold text-text-primary">{inr(grand)} total</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Subscription revenue per month by plan"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + innerH * f}
            y2={PAD_Y + innerH * f}
            stroke="var(--color-gold)"
            strokeOpacity={0.18}
          />
        ))}
        {BANDS.map((b) => {
          const upper = data.map((m, i) => lower[i]! + m[b.key]);
          const top = data.map((_, i) => `${x(i)},${y(upper[i]!)}`);
          const bottom = data
            .map((_, i) => `${x(i)},${y(lower[i]!)}`)
            .reverse();
          const poly = [...top, ...bottom].join(' ');
          upper.forEach((v, i) => {
            lower[i] = v;
          });
          return <polygon key={b.key} points={poly} fill={b.color} fillOpacity={0.85} />;
        })}
        {data.map((m, i) => (
          <text
            key={m.month}
            x={x(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-muted-foreground)"
          >
            {m.month}
          </text>
        ))}
      </svg>
    </ChartShell>
  );
}
