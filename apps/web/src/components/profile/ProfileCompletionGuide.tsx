import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Check, Circle, Sparkles, ShieldCheck } from 'lucide-react';
import type { ProfileSectionCompletion } from '@smartshaadi/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** Overall profile completeness, 0–100. */
  score: number;
  /** Per-section completion map. When absent, the checklist is hidden. */
  sections?: ProfileSectionCompletion;
}

type SectionKey = keyof Omit<ProfileSectionCompletion, 'score' | 'divorceeOnboardingDone'>;

const SEGMENTS: { key: SectionKey; href: string }[] = [
  { key: 'personal',    href: '/profile/personal'    },
  { key: 'photos',      href: '/profile/photos'      },
  { key: 'family',      href: '/profile/family'      },
  { key: 'career',      href: '/profile/career'      },
  { key: 'lifestyle',   href: '/profile/lifestyle'   },
  { key: 'personality', href: '/profile/personality' },
  { key: 'horoscope',   href: '/profile/horoscope'   },
  { key: 'preferences', href: '/profile/preferences' },
];

/** Pure-SVG progress ring — burgundy/gold track, teal arc, % in the centre. */
function ProgressRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative h-28 w-28 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="var(--gold)" strokeOpacity={0.22} strokeWidth={9}
        />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="var(--teal)" strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold leading-none text-primary">{clamped}%</span>
      </div>
    </div>
  );
}

/**
 * Premium first-run profile-completion guide. Replaces the bare "0% complete"
 * empty state with an inviting card: progress ring, a section checklist, why it
 * matters, and a clear next action. Server component (data + i18n only).
 */
export async function ProfileCompletionGuide({ score, sections }: Props) {
  const t = await getTranslations('profileGuide');
  const total = SEGMENTS.length;
  const done = sections ? SEGMENTS.filter((s) => sections[s.key]).length : 0;
  const firstIncomplete = sections ? SEGMENTS.find((s) => !sections[s.key]) : undefined;

  const ctaHref = firstIncomplete?.href ?? '/profile/personal';
  const ctaLabel = done === 0 ? t('ctaStart') : t('ctaContinue');
  const headline = done === 0 ? t('headlineStart') : t('headlineProgress');

  return (
    <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
      {/* Warm invitation header */}
      <div className="border-b border-gold/15 bg-gradient-to-br from-primary/5 via-surface to-gold/5 px-6 py-6 text-center sm:text-left">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          {headline}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('subhead')}</p>
      </div>

      <div className="space-y-6 p-6">
        {/* Progress ring + supporting copy */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ProgressRing score={score} />
          <div className="text-center sm:text-left">
            <p className="font-heading text-lg font-semibold text-primary">
              {t('progressLabel', { done, total })}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <span>{t('whyItMatters')}</span>
            </p>
          </div>
        </div>

        {/* Section checklist — what's done, what remains */}
        {sections ? (
          <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {SEGMENTS.map(({ key, href }) => {
              const complete = sections[key];
              const label = t(`sections.${key}` as 'sections.personal');
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-label={`${label} — ${complete ? t('ringComplete') : ''}`.trim()}
                    className={cn(
                      'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal',
                      complete
                        ? 'border-success/30 bg-success/10 text-success hover:border-success/60 hover:bg-success/15'
                        : 'border-gold/30 bg-gold/5 text-gold-muted hover:border-gold/60 hover:bg-gold/15'
                    )}
                  >
                    {complete ? (
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* Clear next action */}
        <Button asChild className="w-full">
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>

        {/* Trust reassurance */}
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground sm:justify-start sm:text-left">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
          <span>{t('trustNote')}</span>
        </p>
      </div>
    </section>
  );
}
