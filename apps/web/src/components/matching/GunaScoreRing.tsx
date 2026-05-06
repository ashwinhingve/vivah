import { cn } from '@/lib/utils';

interface Props {
  /** Score earned (0–36) */
  score: number;
  /** Total possible — Ashtakoot is 36. */
  total?: number;
  size?: 80 | 110 | 160;
  className?: string;
}

/**
 * Pure SVG ring — server component. Color thresholds:
 *   ≥ 25 / 36 → success green
 *   ≥ 18 / 36 → teal
 *   <  18 / 36 → warning amber
 */
export function GunaScoreRing({ score, total = 36, size = 110, className }: Props) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(score, total) / total) * circumference;

  const ratio = score / total;
  const color =
    ratio >= 25 / 36 ? 'var(--success)' : ratio >= 18 / 36 ? 'var(--teal)' : 'var(--warning)';

  const numFontSize = size <= 80 ? 18 : size <= 110 ? 26 : 36;

  return (
    <div
      className={cn('relative flex-none', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Guna Milan score: ${score} of ${total}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-heading font-bold leading-none"
          style={{ color, fontSize: numFontSize }}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] text-fg-2">/ {total}</span>
      </div>
    </div>
  );
}
