'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface RevenueDay {
  date: string;       // YYYY-MM-DD
  amount: number;
}

interface RevenueSparklineProps {
  data: RevenueDay[];
  className?: string;
}

const WIDTH = 640;
const HEIGHT = 160;
const PAD_X = 16;
const PAD_Y = 20;
const DOT_R = 4;

function formatRs(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function RevenueSparkline({ data, className = '' }: RevenueSparklineProps) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  // x, y stored as percentage of container (0-100) for scale-independent positioning
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: RevenueDay } | null>(null);
  const [mounted, setMounted] = useState(false);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 900; // ms

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (reduced || data.length === 0) {
      setProgress(1);
      return;
    }
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(1, elapsed / DURATION);
      // ease-out cubic
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [data, reduced]);

  if (data.length === 0) {
    return (
      <div className={`flex h-40 items-center justify-center rounded-2xl border border-gold/20 bg-surface text-sm text-muted-foreground ${className}`}>
        No revenue data yet for this period.
      </div>
    );
  }

  const maxAmt = Math.max(...data.map((d) => d.amount), 1);
  const chartW = WIDTH - PAD_X * 2;
  const chartH = HEIGHT - PAD_Y * 2;

  const pts = data.map((d, i) => ({
    x: PAD_X + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD_Y + chartH - (d.amount / maxAmt) * chartH,
    ...d,
  }));

  // Build SVG path
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  // Area path — close back along the baseline
  const areaPath =
    linePath +
    ` L${pts[pts.length - 1]!.x.toFixed(1)},${(PAD_Y + chartH).toFixed(1)}` +
    ` L${pts[0]!.x.toFixed(1)},${(PAD_Y + chartH).toFixed(1)} Z`;

  // Total path length approximation for animation (we use CSS stroke-dasharray trick via clip-path rect)
  // Instead: clip visible portion by progress using a clipRect on x axis
  const clipX = PAD_X + progress * chartW;

  const totalRevenue = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div className={`relative rounded-2xl border border-gold/20 bg-surface p-4 shadow-card ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          30-Day Revenue
        </p>
        <p className="font-heading text-lg font-bold text-primary">{formatRs(totalRevenue)}</p>
      </div>

      <div className="relative w-full overflow-hidden" style={{ paddingBottom: `${(HEIGHT / WIDTH) * 100}%` }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-teal, #0E7C7B)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-teal, #0E7C7B)" stopOpacity="0.0" />
            </linearGradient>
            {/* Clip to reveal left-to-right on mount */}
            <clipPath id="rev-clip">
              <rect x="0" y="0" width={clipX} height={HEIGHT} />
            </clipPath>
          </defs>

          {/* Horizontal gridlines */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD_X}
              y1={PAD_Y + chartH * (1 - f)}
              x2={WIDTH - PAD_X}
              y2={PAD_Y + chartH * (1 - f)}
              stroke="var(--color-gold, #C5A47E)"
              strokeOpacity="0.15"
              strokeWidth="1"
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#rev-fill)" clipPath="url(#rev-clip)" />

          {/* Teal line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-teal, #0E7C7B)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#rev-clip)"
          />

          {/* Gold dots — only show dots that are within clip */}
          {pts.map((p, i) =>
            p.x <= clipX ? (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={DOT_R}
                fill="var(--color-gold, #C5A47E)"
                stroke="var(--background, #FEFAF6)"
                strokeWidth="2"
              />
            ) : null
          )}
        </svg>

        {/* Invisible hit targets for hover tooltip */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          {pts.map((p, i) => (
            <div
              key={i}
              className="relative h-full flex-1 cursor-crosshair"
              onMouseEnter={() => {
                // Store pct positions so tooltip scales with container
                setTooltip({
                  x: (p.x / WIDTH) * 100,
                  y: (p.y / HEIGHT) * 100,
                  day: p,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </div>

        {/* Tooltip — percentage positioned */}
        {mounted && tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-gold/30 bg-surface px-2.5 py-1.5 shadow-card-hover"
            style={{
              left: `${Math.min(Math.max(tooltip.x, 10), 80)}%`,
              top: `${Math.max(0, tooltip.y - 15)}%`,
              transform: 'translateX(-50%)',
              minWidth: 80,
            }}
          >
            <p className="text-2xs text-muted-foreground">{formatDate(tooltip.day.date)}</p>
            <p className="font-heading text-sm font-semibold text-primary">{formatRs(tooltip.day.amount)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
