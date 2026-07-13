/**
 * ProfileCompatibilityCard — Day 9 elevation.
 *
 * Header + Gold rule, then a 2-column composition: large gauge + tier
 * description on the left, Guna Milan breakdown (per life-dimension bars
 * using the existing CompatibilityBreakdown — the 8-factor Ashtakoot
 * detail is not yet surfaced through the matchmaking API) on the right.
 * Below: numbered "Why we matched you" reasons + optional caveat.
 */
import { Sparkles, AlertCircle, Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { CompatibilityScore, MatchExplainer } from '@smartshaadi/types';
import { Link } from '@/i18n/navigation';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber.client';
import { Card } from '@/components/ui/card';
import { UpgradeCTA } from '../ui/UpgradeCTA';

interface Props {
  compatibility: CompatibilityScore;
  explainer: MatchExplainer | null;
  viewerTier: 'FREE' | 'STANDARD' | 'PREMIUM';
  flags: string[];
}

const RING_RADIUS = 64;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function tierColor(tier: CompatibilityScore['tier']): string {
  switch (tier) {
    case 'excellent': return 'var(--color-success)';
    case 'good':      return 'var(--color-teal)';
    case 'average':   return 'var(--color-warning)';
    case 'low':       return 'var(--color-destructive)';
  }
}

/** Qualitative Guna band (Ashtakoot convention out of 36). */
function gunaBand(score: number): 'review' | 'good' | 'veryGood' | 'excellent' {
  if (score < 18) return 'review';
  if (score < 25) return 'good';
  if (score < 33) return 'veryGood';
  return 'excellent';
}

const DIMENSION_LABELS: Record<keyof CompatibilityScore['breakdown'], string> = {
  demographicAlignment:   'Demographics',
  lifestyleCompatibility: 'Lifestyle',
  careerEducation:        'Career & Education',
  familyValues:           'Family Values',
  preferenceOverlap:      'Preferences',
  personalityFit:         'Personality',
  behaviourCompatibility: 'Behaviour',
};

function pctColor(pct: number): string {
  if (pct >= 80) return 'var(--color-teal)';
  if (pct >= 60) return 'var(--color-gold)';
  return 'var(--color-primary)';
}

function DimensionBar({
  label,
  score,
  max,
  lowFlag,
}: {
  label: string;
  score: number;
  max: number;
  lowFlag?: boolean;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const accent = pctColor(pct);
  return (
    <div className="grid grid-cols-[6rem_1fr_3rem] items-start gap-2 sm:grid-cols-[7rem_1fr_3.5rem] sm:items-center sm:gap-2.5">
      <span className="line-clamp-2 text-xs leading-tight text-foreground">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-border-light">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      <span className="flex items-center justify-end gap-1 text-right text-xs font-semibold tabular-nums text-foreground/80">
        {score}/{max}
        {lowFlag ? (
          <AlertCircle className="h-3 w-3 text-warning" aria-label="Below threshold" />
        ) : null}
      </span>
    </div>
  );
}

export async function ProfileCompatibilityCard({ compatibility, explainer, viewerTier, flags }: Props) {
  const { totalScore, breakdown, gunaScore, tier } = compatibility;
  const t = await getTranslations('profileDetail');
  const color = tierColor(tier);
  const tierLabel = t(`compatibility.tier.${tier}`);
  const tierSub = t(`compatibility.tierSub.${tier}`);
  const progress = Math.min(Math.max(totalScore, 0) / 100, 1);
  const dashOffset = RING_CIRC * (1 - progress);
  const gunaCalculating = flags.includes('guna_pending') || flags.includes('guna_parse_error');
  const horoscopeMissing = !gunaCalculating && gunaScore == null;

  const reasons = explainer?.reasons ?? [];
  const reasonsLocked = viewerTier === 'FREE';

  return (
    <Card premium className="overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 text-center">
        <h2 className="font-heading text-[24px] font-semibold text-primary">{t('compatibility.heading')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('compatibility.subheading')}
        </p>
        <div className="mx-auto mt-3 h-px w-2/5 bg-gold/40" aria-hidden="true" />
      </div>

      {/* 2-column composition */}
      <div className="grid grid-cols-1 gap-6 px-5 pb-5 lg:grid-cols-[3fr_2fr]">

        {/* Left — Gauge + percentage + tier description */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 160 160" className="-rotate-90 h-full w-full" aria-hidden="true">
              <circle cx="80" cy="80" r={RING_RADIUS} fill="none" stroke="var(--color-border-light)" strokeWidth="12" />
              <circle
                cx="80" cy="80" r={RING_RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber
                value={totalScore}
                duration={0.8}
                percent
                className="font-heading text-3xl font-bold tabular-nums leading-none text-primary"
              />
              <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{t('compatibility.matchLabel')}</span>
            </div>
          </div>
          <p className="font-heading text-xl text-primary">{t('compatibility.tierLabel', { tier: tierLabel })}</p>
          <p className="max-w-[200px] text-center text-xs text-muted-foreground">{tierSub}</p>
        </div>

        {/* Right — Guna Milan / dimension breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-base font-semibold text-primary">{t('guna.title')}</h3>
            {gunaCalculating ? (
              <span className="text-[10px] italic text-muted-foreground">{t('guna.calculating')}</span>
            ) : gunaScore != null ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-teal">
                {t('guna.score', { score: gunaScore, band: t(`guna.bands.${gunaBand(gunaScore)}`) })}
              </span>
            ) : null}
          </div>

          {horoscopeMissing ? (
            <Link
              href="/profile/horoscope"
              className="block rounded-2xl border border-dashed border-gold/40 bg-gold/5 px-4 py-3 text-center transition-colors hover:bg-gold/10"
            >
              <Sparkles className="mx-auto h-5 w-5 text-gold-muted" aria-hidden="true" />
              <p className="mt-1 text-sm font-semibold text-primary">{t('guna.addTitle')}</p>
              <p className="text-[11px] text-muted-foreground">{t('guna.addSub')}</p>
            </Link>
          ) : (
            <div className="space-y-2.5">
              {(Object.entries(breakdown) as [keyof typeof breakdown, { score: number; max: number; coldStart?: boolean }][]).map(
                ([key, factor]) => {
                  if (key === 'behaviourCompatibility' && factor.coldStart) return null;
                  const pct = factor.max > 0 ? (factor.score / factor.max) * 100 : 0;
                  return (
                    <DimensionBar
                      key={key}
                      label={DIMENSION_LABELS[key] ?? key}
                      score={factor.score}
                      max={factor.max}
                      lowFlag={pct < 40}
                    />
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Why we matched you — numbered list */}
      {reasons.length > 0 && (
        <div className="border-t border-gold/10 px-5 py-5">
          <h3 className="font-heading text-base font-semibold text-primary">{t('whyMatched.title')}</h3>
          <ol className={`mt-3 space-y-2.5 ${reasonsLocked ? 'pointer-events-none select-none blur-sm' : ''}`}>
            {reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-heading text-xs font-bold text-gold-muted">
                  {i + 1}
                </span>
                <span className="font-heading text-sm italic leading-relaxed text-foreground">{reason}</span>
              </li>
            ))}
          </ol>
          {reasonsLocked && (
            <div className="mt-3">
              <UpgradeCTA
                variant="inline"
                requiredTier="STANDARD"
                feature="Why You Match"
                message="See the top reasons we matched you — upgrade to Standard."
              />
            </div>
          )}
          {explainer?.caveat ? (
            <p className="mt-4 flex items-start gap-2 text-xs text-gold-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t('whyMatched.note', { caveat: explainer.caveat })}</span>
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
