'use client';

import type { MatchWeek } from './types';

const W = 720;
const H = 240;
const PAD_X = 36;
const PAD_Y = 28;

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {children}
    </div>
  );
}

export function MatchActivityChart({ data }: { data: MatchWeek[] | null }) {
  if (!data || data.length === 0) {
    return (
      <ChartShell>
        <div className="flex h-44 items-center justify-center text-sm text-text-muted">
          No match activity for this period.
        </div>
      </ChartShell>
    );
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.sent, d.accepted]), 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const slot = innerW / data.length;
  const barW = Math.min(22, slot / 3);
  const y = (v: number): number => PAD_Y + innerH - (v / maxVal) * innerH;

  return (
    <ChartShell>
      <div className="mb-3 flex items-center gap-4 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-primary)' }} />
          Interests sent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-teal)' }} />
          Matches accepted
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Interests sent versus matches accepted, per week"
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
        {data.map((d, i) => {
          const cx = PAD_X + slot * i + slot / 2;
          return (
            <g key={d.week}>
              <rect
                x={cx - barW - 1}
                y={y(d.sent)}
                width={barW}
                height={PAD_Y + innerH - y(d.sent)}
                rx={2}
                fill="var(--color-primary)"
              />
              <rect
                x={cx + 1}
                y={y(d.accepted)}
                width={barW}
                height={PAD_Y + innerH - y(d.accepted)}
                rx={2}
                fill="var(--color-teal)"
              />
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-muted-foreground)"
              >
                {d.week.replace(/^\d{4}-/, '')}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartShell>
  );
}
