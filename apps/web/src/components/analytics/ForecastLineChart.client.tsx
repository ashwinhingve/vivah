'use client';

import { useTranslations } from 'next-intl';

/**
 * Forecast line chart — historical solid + projected dashed.
 *
 * Pure SVG chart (no libraries) following the RevenueChart pattern.
 * Displays historical series as solid line, forecast as dashed continuation.
 *   - Responsive viewBox (720 × 280)
 *   - Padding + grid lines
 *   - Design-token colors (primary, teal, gold)
 *   - aria-label for accessibility
 */

interface ForecastChartData {
  label: string;
  history: Array<{ month: string; value: number }>;
  forecast: number[];
  unit?: string;
}

const W = 720;
const H = 280;
const PAD_X = 44;
const PAD_Y = 24;

function ChartShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      {children}
    </div>
  );
}

export function ForecastLineChart({
  data,
}: {
  data: ForecastChartData | null;
}): React.ReactNode {
  const t = useTranslations('adminAnalyticsForecast');

  if (!data || data.history.length === 0) {
    return (
      <ChartShell>
        <div className="flex h-56 flex-col items-center justify-center gap-1 text-center text-sm text-text-muted">
          <span>{t('noDataAvailable')}</span>
          <span className="text-xs">{t('noDataHint')}</span>
        </div>
      </ChartShell>
    );
  }

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  // Find max value across history + forecast for scaling
  const allValues = [
    ...data.history.map(h => h.value),
    ...data.forecast,
  ];
  const maxValue = Math.max(...allValues, 1);

  // Helper to scale coordinates
  const x = (i: number, total: number): number =>
    total === 1
      ? PAD_X + innerW / 2
      : PAD_X + (i / (total - 1)) * innerW;

  const y = (v: number): number =>
    PAD_Y + innerH - (v / maxValue) * innerH;

  const totalPoints = data.history.length + data.forecast.length;

  // Build historical line points
  const historyPoints = data.history.map((h, i) => ({
    x: x(i, totalPoints),
    y: y(h.value),
  }));

  // Build forecast line points
  const forecastStartX = x(data.history.length - 1, totalPoints);
  const forecastStartY = y(data.history[data.history.length - 1]!.value);
  const forecastPoints = [
    { x: forecastStartX, y: forecastStartY },
    ...data.forecast.map((f, i) => ({
      x: x(data.history.length + i, totalPoints),
      y: y(f),
    })),
  ];

  // Format value for display
  const formatValue = (v: number): string => {
    if (data.unit === 'rupees') {
      if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
      if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
      return `₹${Math.round(v)}`;
    }
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toString();
  };

  // Format month label
  const formatMonth = (monthStr: string): string => {
    const [, m] = monthStr.split('-');
    const monthNames = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return monthNames[parseInt(m!, 10) - 1] ?? m ?? '';
  };

  return (
    <ChartShell>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-primary)' }} />
          {t('chartLabelHistorical')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: 'var(--color-primary)', opacity: 0.5 }}
          />
          {t('chartLabelForecast')}
        </span>
        <span className="ml-auto font-semibold text-text-primary">
          {formatValue(data.history[data.history.length - 1]?.value ?? 0)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${data.label} forecast: historical data (solid line) and 6-month projection (dashed line)`}
      >
        {/* Grid lines */}
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

        {/* Historical line (solid) */}
        {historyPoints.length > 1 && (
          <polyline
            points={historyPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Forecast line (dashed) */}
        {forecastPoints.length > 1 && (
          <polyline
            points={forecastPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeOpacity={0.6}
            strokeDasharray="4,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points on historical */}
        {historyPoints.map((p, i) => (
          <circle
            key={`hist-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="var(--color-primary)"
            fillOpacity={0.8}
          />
        ))}

        {/* Data points on forecast (lighter) */}
        {forecastPoints.slice(1).map((p, i) => (
          <circle
            key={`forecast-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill="var(--color-primary)"
            fillOpacity={0.4}
          />
        ))}

        {/* Month labels (every nth to avoid crowding) */}
        {data.history.map((h, i) => {
          const showLabel = data.history.length <= 6 || i % Math.ceil(data.history.length / 6) === 0;
          if (!showLabel) return null;
          return (
            <text
              key={`month-${i}`}
              x={historyPoints[i]!.x}
              y={H - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-muted-foreground)"
            >
              {formatMonth(h.month)}
            </text>
          );
        })}

        {/* Forecast label on axis */}
        {data.forecast.length > 0 && (
          <text
            x={PAD_X}
            y={PAD_Y - 6}
            fontSize={10}
            fill="var(--color-muted-foreground)"
            fillOpacity={0.7}
          >
            {t('chartForecastMonths')}
          </text>
        )}
      </svg>
    </ChartShell>
  );
}
