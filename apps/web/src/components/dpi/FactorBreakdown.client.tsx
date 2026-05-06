'use client';

import type { DpiFactorContribution } from '@smartshaadi/types';

const FACTOR_LABELS: Record<string, string> = {
  family_values_alignment: 'Family priorities',
  income_disparity_pct: 'Financial expectations',
  age_gap_years: 'Age difference',
  lifestyle_compatibility: 'Daily life preferences',
  communication_score: 'How you communicate',
  guna_milan_score: 'Astrological compatibility',
  geographic_distance_km: 'Location difference',
  religion_caste_match: 'Religion & community',
  preference_match_pct: 'Stated preferences alignment',
  education_gap: 'Education backgrounds',
};

function translateFactorName(factor: string): string {
  if (FACTOR_LABELS[factor]) return FACTOR_LABELS[factor];
  return factor
    .split('_')
    .map((s) => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s))
    .join(' ');
}

const DIRECTION_TEXT: Record<DpiFactorContribution['direction'], string> = {
  protective: 'strong alignment between you',
  concern: 'worth discussing openly',
  neutral: 'moderate, not concerning',
};

const DIRECTION_FILL: Record<DpiFactorContribution['direction'], string> = {
  protective: '#7FA682',
  concern: '#C5A47E',
  neutral: '#9B9BA5',
};

const DIRECTION_GLYPH: Record<DpiFactorContribution['direction'], string> = {
  protective: '✓',
  concern: '⚠',
  neutral: '—',
};

function DirectionIcon({ direction }: { direction: DpiFactorContribution['direction'] }) {
  const fill = DIRECTION_FILL[direction];
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="shrink-0"
    >
      <circle cx="10" cy="10" r="10" fill={fill} fillOpacity={0.15} />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={fill}
      >
        {DIRECTION_GLYPH[direction]}
      </text>
    </svg>
  );
}

interface Props {
  topFactors: DpiFactorContribution[];
}

export function FactorBreakdown({ topFactors }: Props) {
  if (topFactors.length === 0) return null;
  return (
    <details className="mt-6 border-t border-gold/20 pt-4 group">
      <summary className="text-sm text-teal cursor-pointer hover:underline list-none flex items-center gap-1.5 select-none">
        <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
        See what shaped this analysis
      </summary>

      <ul className="mt-4 space-y-3">
        {topFactors.map((factor) => {
          const niceName = translateFactorName(factor.factor);
          const context = DIRECTION_TEXT[factor.direction];
          return (
            <li key={factor.factor} className="flex items-start gap-3 text-sm text-foreground">
              <DirectionIcon direction={factor.direction} />
              <span className="leading-snug">
                <span className="font-medium">{niceName}</span>
                <span className="text-muted-foreground"> — {context}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
