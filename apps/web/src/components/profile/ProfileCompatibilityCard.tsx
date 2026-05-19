/**
 * ProfileCompatibilityCard
 *
 * Renders the full compatibility section on the profile detail page.
 * Uses data from GET /api/v1/matchmaking/score/:profileId:
 *   { totalScore, breakdown, gunaScore, tier, flags, explainer, distanceKm }
 *
 * Does NOT fabricate per-factor Ashtakoot pills. Uses only the 6-factor
 * breakdown from the real API shape.
 */
import type { CompatibilityScore, MatchExplainer } from '@smartshaadi/types';
import { Card } from '@/components/ui/card';
import { WhyMatchPanel } from './WhyMatchPanel';

interface Props {
  compatibility: CompatibilityScore;
  explainer: MatchExplainer | null;
  viewerTier: 'FREE' | 'STANDARD' | 'PREMIUM';
  /** If flags includes 'guna_pending' or 'guna_parse_error', show calculating note */
  flags: string[];
}

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getTierConfig(tier: CompatibilityScore['tier']): { color: string; label: string; bgClass: string; textClass: string } {
  switch (tier) {
    case 'excellent': return { color: 'var(--color-success)',     label: 'Excellent Match', bgClass: 'bg-success/10',     textClass: 'text-success' };
    case 'good':      return { color: 'var(--color-teal)',        label: 'Good Match',      bgClass: 'bg-teal/10',        textClass: 'text-teal' };
    case 'average':   return { color: 'var(--color-warning)',     label: 'Average Match',   bgClass: 'bg-warning/10',     textClass: 'text-warning' };
    case 'low':       return { color: 'var(--color-destructive)', label: 'Low Match',       bgClass: 'bg-destructive/10', textClass: 'text-destructive' };
  }
}

const BREAKDOWN_LABELS: Record<keyof CompatibilityScore['breakdown'], string> = {
  demographicAlignment:   'Demographics',
  lifestyleCompatibility: 'Lifestyle',
  careerEducation:        'Career & Education',
  familyValues:           'Family Values',
  preferenceOverlap:      'Preferences',
  personalityFit:         'Personality',
  behaviourCompatibility: 'Behaviour',
};

function BreakdownBar({
  label,
  score,
  max,
  accent,
}: {
  label: string;
  score: number;
  max: number;
  accent: string;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color: accent }}>
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border-light overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}

export function ProfileCompatibilityCard({ compatibility, explainer, viewerTier, flags }: Props) {
  const { totalScore, breakdown, gunaScore, tier } = compatibility;
  const tierConfig = getTierConfig(tier);
  const progress = Math.min(totalScore / 100, 1);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const gunaCalculating =
    flags.includes('guna_pending') || flags.includes('guna_parse_error');

  return (
    <Card premium className="overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gold/20">
        <h2 className="font-heading text-lg font-semibold text-primary">Compatibility</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Based on 6 life dimensions + Vedic matching</p>
      </div>

      {/* Score ring + tier + guna chip */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-5">
        {/* Animated SVG ring */}
        <div className="relative shrink-0 w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke="var(--color-border-light)"
              strokeWidth="9"
            />
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none"
              stroke={tierConfig.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.7s ease-out, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold leading-none tabular-nums" style={{ color: tierConfig.color }}>
              {totalScore}
            </span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        {/* Tier + Guna */}
        <div className="flex-1 min-w-0 space-y-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tierConfig.bgClass} ${tierConfig.textClass}`}
          >
            {tierConfig.label}
          </span>

          {gunaCalculating ? (
            <p className="text-xs text-muted-foreground italic">Guna score calculating…</p>
          ) : gunaScore != null ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
              <span
                className="font-heading text-sm font-semibold text-gold-muted"
                style={{ fontFamily: '"Noto Serif Devanagari", "Playfair Display", serif' }}
              >
                गुण
              </span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {gunaScore}/36
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className={`text-[10px] font-medium ${
                gunaScore >= 27 ? 'text-success' :
                gunaScore >= 18 ? 'text-teal' :
                gunaScore >= 12 ? 'text-warning' : 'text-destructive'
              }`}>
                {gunaScore >= 27 ? 'Excellent' : gunaScore >= 18 ? 'Good' : gunaScore >= 12 ? 'Average' : 'Low'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="px-5 pb-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Life Dimensions
        </p>
        {(Object.entries(breakdown) as [keyof typeof breakdown, { score: number; max: number; coldStart?: boolean }][]).map(
          ([key, factor]) => {
            if (key === 'behaviourCompatibility' && factor.coldStart) return null;
            const label = BREAKDOWN_LABELS[key] ?? key;
            return (
              <BreakdownBar
                key={key}
                label={label}
                score={factor.score}
                max={factor.max}
                accent={tierConfig.color}
              />
            );
          }
        )}
      </div>

      {/* Why Match panel */}
      {explainer && (explainer.reasons.length > 0 || explainer.caveat) && (
        <div className="px-5 pb-5 border-t border-gold/10 pt-4">
          <WhyMatchPanel explainer={explainer} tier={viewerTier} />
        </div>
      )}
    </Card>
  );
}
