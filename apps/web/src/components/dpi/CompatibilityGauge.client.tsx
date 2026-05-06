'use client';

import { useEffect, useState } from 'react';
import type { DpiResponse } from '@smartshaadi/types';
import { fetchDpi } from '@/app/actions/ai';
import { FactorBreakdown } from './FactorBreakdown.client';

interface Props {
  matchId: string;
}

const LEVEL_COLOR: Record<DpiResponse['level'], string> = {
  LOW: '#7FA682',
  MEDIUM: '#C5A47E',
  HIGH: '#7B2D42',
};

const TRACK_COLOR = '#E5E5E5';

const RADIUS = 100;
const STROKE_WIDTH = 18;
const ARC_LENGTH = Math.PI * RADIUS;
const VIEW_W = 240;
const VIEW_H = 140;

function ArcSemicircle({ score, level }: { score: number; level: DpiResponse['level'] }) {
  const safeScore = Math.max(0, Math.min(1, score));
  const dashLength = ARC_LENGTH * safeScore;
  const dashGap = ARC_LENGTH - dashLength;
  const color = LEVEL_COLOR[level];

  const cx = VIEW_W / 2;
  const cy = VIEW_H - 20;
  const arc = `M ${cx - RADIUS},${cy} A ${RADIUS},${RADIUS} 0 0 1 ${cx + RADIUS},${cy}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMax meet"
      className="block max-w-[280px] mx-auto"
      role="presentation"
      aria-hidden
    >
      <path
        d={arc}
        fill="none"
        stroke={TRACK_COLOR}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${dashGap}`}
        style={{ transition: 'stroke-dasharray 600ms ease-out' }}
      />
    </svg>
  );
}

function GaugeSkeleton() {
  return (
    <div className="text-center" aria-busy="true" aria-live="polite">
      <div className="mx-auto h-[140px] w-full max-w-[280px] rounded-t-full bg-muted/40 animate-pulse" />
      <p className="mt-4 text-sm text-muted-foreground">Analysing compatibility patterns…</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        We couldn&apos;t generate detailed analysis right now. Please try again in a moment.
      </p>
    </div>
  );
}

export function CompatibilityGauge({ matchId }: Props) {
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

  if (loading) return <GaugeSkeleton />;
  if (!data) return <ErrorState />;

  return (
    <div>
      <div className="relative">
        <ArcSemicircle score={data.score} level={data.level} />
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
