import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Check, Circle, Sparkles, ArrowRight } from 'lucide-react';
import type { ProfileSectionCompletion } from '@smartshaadi/types';
import { cn } from '@/lib/utils';

interface Props {
  sections: ProfileSectionCompletion;
}

type SectionKey =
  | 'personal'
  | 'photos'
  | 'family'
  | 'career'
  | 'lifestyle'
  | 'personality'
  | 'horoscope'
  | 'preferences';

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

export async function ProfileCompletenessCard({ sections }: Props) {
  const t = await getTranslations('dashboard.profileCompleteness');
  const total = SEGMENTS.length;
  const done = SEGMENTS.filter((s) => sections[s.key]).length;
  const score = sections.score;
  const firstIncomplete = SEGMENTS.find((s) => !sections[s.key]);

  return (
    <div className="rounded-2xl border border-gold/25 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-primary">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('sectionsComplete', { done, total })}
          </p>
        </div>
        <span className="font-heading text-3xl font-bold leading-none text-primary">
          {score}<span className="text-base font-semibold">%</span>
        </span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gold/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal to-teal-hover transition-all duration-700 ease-out"
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SEGMENTS.map(({ key, href }) => {
          const complete = sections[key];
          const label = t(`sections.${key}` as 'sections.personal');
          return (
            <Link
              key={key}
              href={href}
              aria-label={complete
                ? t('sectionComplete', { label })
                : t('sectionIncomplete', { label })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:-translate-y-0.5',
                complete
                  ? 'border-success/30 bg-success/10 text-success hover:border-success/60 hover:bg-success/15'
                  : 'border-gold/30 bg-gold/5 text-gold-muted hover:border-gold/60 hover:bg-gold/15'
              )}
            >
              {complete ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Circle className="h-3 w-3" aria-hidden="true" />
              )}
              {label}
            </Link>
          );
        })}
      </div>

      {firstIncomplete ? (
        <Link
          href={firstIncomplete.href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {done === total - 1
            ? t('oneStepAway', { section: t(`sections.${firstIncomplete.key}` as 'sections.personal') })
            : t('completeSection', { section: t(`sections.${firstIncomplete.key}` as 'sections.personal') })}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-4 text-sm font-semibold text-success" aria-live="polite">
          {t('allComplete')}
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {t('moreMatches')}
      </p>
    </div>
  );
}
