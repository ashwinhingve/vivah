'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DpiResponse } from '@smartshaadi/types';
import { fetchDpi } from '@/app/actions/ai';
import { FactorBreakdown } from './FactorBreakdown.client';

interface Props {
  matchId: string;
}

const LEVEL_STROKE: Record<DpiResponse['level'], string> = {
  LOW: 'var(--color-teal)',
  MEDIUM: 'var(--color-gold)',
  HIGH: 'var(--color-primary)',
};

const TRACK_STROKE = 'var(--color-border)';

const RADIUS = 100;
const STROKE_WIDTH = 18;
const ARC_LENGTH = Math.PI * RADIUS;
const VIEW_W = 240;
const VIEW_H = 140;

export function ArcSemicircle({
  score,
  level,
  label,
}: {
  score: number;
  level: DpiResponse['level'];
  label: string;
}) {
  const safeScore = Math.max(0, Math.min(1, score));
  const dashLength = ARC_LENGTH * safeScore;
  const dashGap = ARC_LENGTH - dashLength;
  const stroke = LEVEL_STROKE[level];
  const percent = Math.round(safeScore * 100);

  const cx = VIEW_W / 2;
  const cy = VIEW_H - 20;
  const arc = `M ${cx - RADIUS},${cy} A ${RADIUS},${RADIUS} 0 0 1 ${cx + RADIUS},${cy}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMax meet"
      className="block max-w-[280px] mx-auto"
      role="img"
      aria-label={`Compatibility ${percent}%. ${label}.`}
    >
      <path
        d={arc}
        fill="none"
        stroke={TRACK_STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${dashGap}`}
        style={{ transition: 'stroke-dasharray 600ms ease-out' }}
      />
    </svg>
  );
}

function GaugeSkeleton({ analysing }: { analysing: string }) {
  return (
    <div className="text-center" aria-busy="true" aria-live="polite">
      <div className="mx-auto h-[140px] w-full max-w-[280px] rounded-t-full bg-muted/40 animate-pulse" />
      <p className="mt-4 text-sm text-muted-foreground">{analysing}</p>
    </div>
  );
}

function ErrorState({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {errorMessage}
      </p>
    </div>
  );
}

export function CompatibilityGauge({ matchId }: Props) {
  const t = useTranslations('compatibility');
  const [data, setData] = useState<DpiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchDpi(matchId).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) return <GaugeSkeleton analysing={t('analysing')} />;
  if (!data) return <ErrorState errorMessage={t('errorMessage')} />;

  return (
    <div>
      <div className="relative">
        <ArcSemicircle score={data.score} level={data.level} label={data.label} />
        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-0.5 px-2 text-center">
          <p className="font-heading text-2xl text-primary leading-tight">{data.label}</p>
        </div>
      </div>

      <p className="mt-6 text-sm text-foreground leading-relaxed max-w-[60ch] mx-auto text-center">
        {data.narrative}
      </p>

      <p className="mt-4 text-sm italic text-foreground leading-relaxed max-w-[60ch] mx-auto text-center">
        <span aria-hidden>💬 </span>Try discussing: {data.suggestion}
      </p>

      <FactorBreakdown topFactors={data.top_factors} />
    </div>
  );
}
