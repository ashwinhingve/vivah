'use client';

import { useState } from 'react';
import type { SignupPoint } from './types';

const W = 720;
const H = 220;
const PAD_X = 36;
const PAD_Y = 24;

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {children}
    </div>
  );
}

export function SignupsChart({ data }: { data: SignupPoint[] | null }) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <ChartShell>
        <div className="flex h-44 items-center justify-center text-sm text-text-muted">
          No signup data for this period.
        </div>
      </ChartShell>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const x = (i: number): number =>
    PAD_X + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number): number => PAD_Y + innerH - (v / maxCount) * innerH;

  const line = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const area = `${PAD_X},${PAD_Y + innerH} ${line} ${PAD_X + innerW},${PAD_Y + innerH}`;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ChartShell>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm text-text-muted">
          <span className="font-heading text-lg font-semibold text-primary">{total}</span> new
          signups
        </p>
        <p className="text-xs text-text-muted">{data.length} days</p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Daily signups, ${total} total over ${data.length} days`}
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
            strokeWidth={1}
          />
        ))}
        <polygon points={area} fill="var(--color-teal)" fillOpacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((d, i) => (
          <g key={d.date}>
            {hover === i && (
              <>
                <circle cx={x(i)} cy={y(d.count)} r={4} fill="var(--color-teal)" />
                <text
                  x={x(i)}
                  y={y(d.count) - 10}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--color-foreground)"
                  fontWeight={600}
                >
                  {d.count} · {fmtDate(d.date)}
                </text>
              </>
            )}
            <rect
              x={x(i) - innerW / data.length / 2}
              y={PAD_Y}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        <text x={PAD_X} y={H - 4} fontSize={11} fill="var(--color-muted-foreground)">
          {fmtDate(data[0]!.date)}
        </text>
        <text
          x={W - PAD_X}
          y={H - 4}
          fontSize={11}
          textAnchor="end"
          fill="var(--color-muted-foreground)"
        >
          {fmtDate(data[data.length - 1]!.date)}
        </text>
      </svg>
    </ChartShell>
  );
}
