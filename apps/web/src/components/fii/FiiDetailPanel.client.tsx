'use client';

import { useEffect, useState } from 'react';
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
  'Family-First':         '#7B2D42',
  'Family-Oriented':      '#C5A47E',
  'Balanced':             '#0E7C7B',
  'Independent-Leaning':  '#7FA682',
  'Independent':          '#6B6B76',
};

const SIGNAL_NAME: Record<keyof FiiBreakdown, string> = {
  family_type_preference:    'Family structure preference',
  family_values_orientation: 'Family values orientation',
  parents_living_intent:     'Living arrangement with parents',
  family_decisions:          'Family in decisions',
  cultural_events:           'Cultural events & celebrations',
  siblings_engagement:       'Closeness with siblings',
  religious_practice:        'Religious practice',
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
        backgroundColor: `${color}26`,
        borderColor: `${color}4D`,
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
  const [data, setData] = useState<FiiCompatibility | null>(null);
  const [loading, setLoading] = useState(true);

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
        Family &amp; Lifestyle Outlook
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        How each of you sees family&rsquo;s role in life decisions.
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
        <span className="text-sm text-muted-foreground">Compatibility:</span>
        <CompatibilityPill label={data.compatibility} color={data.compatibility_color} />
      </div>

      <p className="text-foreground leading-relaxed mb-3">
        {data.narrative}
      </p>

      <p className="text-foreground italic mb-6">
        Try discussing: {data.discussion_starter}
      </p>

      <details className="border-t border-gold/20 pt-4">
        <summary className="text-sm text-teal cursor-pointer hover:underline list-none">
          See what shapes this score
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
