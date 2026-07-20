'use client';

import { useTranslations } from 'next-intl';
import type { StayBucket, StayTier } from './types';

const R = 70;
const STROKE = 26;
const C = 2 * Math.PI * R;

export function StayQuotientChart({ data }: { data: StayBucket[] | null }) {
  const t = useTranslations('stayQuotient');

  const TIER_META: Record<StayTier, { label: string; color: string }> = {
    ENGAGED: { label: t('tiers.engaged'), color: 'var(--color-success)' },
    LOW_RISK: { label: t('tiers.lowRisk'), color: 'var(--color-teal)' },
    MEDIUM_RISK: { label: t('tiers.mediumRisk'), color: 'var(--color-warning)' },
    HIGH_RISK: { label: t('tiers.highRisk'), color: 'var(--color-destructive)' },
  };

  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;

  if (!data || total === 0) {
    return (
      <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
        <div className="flex h-44 items-center justify-center text-sm text-text-muted">
          {t('noData')}
        </div>
      </div>
    );
  }

  let offset = 0;
  const segments = data.map((d) => {
    const frac = d.count / total;
    const seg = { ...d, dash: frac * C, gap: C - frac * C, off: offset };
    offset -= frac * C;
    return seg;
  });

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
      <p className="mb-1 text-xs font-medium text-text-muted">
        {t('subtitle')} ({total} active {t('profilesLabel')})
      </p>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
        <svg viewBox="0 0 200 200" className="h-44 w-44" role="img" aria-label={t('subtitle')}>
          <g transform="rotate(-90 100 100)">
            {segments.map((s) => (
              <circle
                key={s.tier}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={TIER_META[s.tier].color}
                strokeWidth={STROKE}
                strokeDasharray={`${s.dash} ${s.gap}`}
                strokeDashoffset={s.off}
              />
            ))}
          </g>
          <text
            x={100}
            y={96}
            textAnchor="middle"
            fontSize={26}
            fontWeight={700}
            fill="var(--color-primary)"
          >
            {total}
          </text>
          <text x={100} y={116} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)">
            {t('profilesLabel')}
          </text>
        </svg>
        <ul className="space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.tier} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ background: TIER_META[d.tier].color }}
              />
              <span className="text-text-primary">{TIER_META[d.tier].label}</span>
              <span className="ml-auto pl-4 font-semibold text-text-primary">
                {d.count}
                <span className="ml-1 text-xs font-normal text-text-muted">
                  ({Math.round((d.count / total) * 100)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
