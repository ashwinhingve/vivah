'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  FiiCompatibility,
  FiiLabel,
  FiiBreakdown,
} from '@smartshaadi/types';
import { fetchFiiCompatibility } from '@/app/actions/ai';

interface Props {
  matchId: string;
  profileAName?: string;
  profileBName?: string;
}

const LABEL_COLOR: Record<FiiLabel, string> = {
  'Family-First':         'var(--color-primary)',
  'Family-Oriented':      'var(--color-gold)',
  'Balanced':             'var(--color-teal)',
  'Independent-Leaning':  'var(--color-success)',
  'Independent':          'var(--color-text-muted)',
};

function ScoreBar({ name, score, label }: { name: string; score: number; label: FiiLabel }) {
  const fill = LABEL_COLOR[label];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground">
          {name} <span className="text-muted-foreground font-normal">— {label}</span>
        </span>
        <span className="text-xs text-muted-foreground">{score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gold/15 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  );
}

function CompatibilityPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-xs font-medium border"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function PanelSkeleton() {
  return (
    <section className="mt-8 border-t border-gold/20 pt-8" aria-busy="true">
      <div className="h-6 w-56 bg-muted/40 rounded animate-pulse mb-2" />
      <div className="h-4 w-72 bg-muted/30 rounded animate-pulse mb-6" />
      <div className="space-y-4">
        <div className="h-10 bg-muted/30 rounded animate-pulse" />
        <div className="h-10 bg-muted/30 rounded animate-pulse" />
      </div>
    </section>
  );
}

export function FiiDetailPanel({ matchId, profileAName, profileBName }: Props) {
  const t = useTranslations('fii');
  const [data, setData] = useState<FiiCompatibility | null>(null);
  const [loading, setLoading] = useState(true);

  const SIGNAL_NAME: Record<keyof FiiBreakdown, string> = {
    family_type_preference:    t('signals.familyTypePreference'),
    family_values_orientation: t('signals.familyValuesOrientation'),
    parents_living_intent:     t('signals.parentsLivingIntent'),
    family_decisions:          t('signals.familyDecisions'),
    cultural_events:           t('signals.culturalEvents'),
    siblings_engagement:       t('signals.siblingsEngagement'),
    religious_practice:        t('signals.religiousPractice'),
  };

  useEffect(() => {
    let cancelled = false;
    fetchFiiCompatibility(matchId, true)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (loading) return <PanelSkeleton />;
  if (!data) return null;

  const nameA = profileAName ?? 'You';
  const nameB = profileBName ?? 'Your match';

  return (
    <section className="mt-8 border-t border-gold/20 pt-8">
      <h2 className="font-heading text-primary text-xl mb-2">
        {t('heading')}
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        {t('subheading')}
      </p>

      <div className="space-y-4 mb-6">
        <ScoreBar
          name={nameA}
          score={data.profile_a_score.score}
          label={data.profile_a_score.label}
        />
        <ScoreBar
          name={nameB}
          score={data.profile_b_score.score}
          label={data.profile_b_score.label}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">{t('compatibility')}:</span>
        <CompatibilityPill label={data.compatibility} color={data.compatibility_color} />
      </div>

      <p className="text-foreground leading-relaxed mb-3">
        {data.narrative}
      </p>

      <p className="text-foreground italic mb-6">
        {t('discussionStarter')}: {data.discussion_starter}
      </p>

      <details className="border-t border-gold/20 pt-4">
        <summary className="text-sm text-teal cursor-pointer hover:underline list-none">
          {t('detailsToggle')}
        </summary>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {(Object.keys(SIGNAL_NAME) as Array<keyof FiiBreakdown>).map((key) => {
            const aVal = data.profile_a_score.breakdown[key];
            const bVal = data.profile_b_score.breakdown[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-gold/20 bg-background p-3"
              >
                <p className="text-xs text-muted-foreground mb-1.5">{SIGNAL_NAME[key]}</p>
                <div className="flex items-center justify-between text-xs text-foreground">
                  <span>{nameA}: <span className="font-medium">{aVal}</span></span>
                  <span>{nameB}: <span className="font-medium">{bVal}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
