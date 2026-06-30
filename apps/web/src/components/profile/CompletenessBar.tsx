import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Check, Circle, Sparkles } from 'lucide-react';
import type { ProfileSectionCompletion } from '@smartshaadi/types';
import { cn } from '@/lib/utils';

interface Props {
  sections: ProfileSectionCompletion;
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

function tone(score: number) {
  if (score >= 80) return { bar: 'from-gold via-teal to-success', text: 'text-success' };
  if (score >= 50) return { bar: 'from-warning via-gold to-teal',  text: 'text-teal' };
  return { bar: 'from-destructive via-warning to-gold', text: 'text-warning' };
}

export async function CompletenessBar({ sections }: Props) {
  const tr = await getTranslations('profileGuide');
  const t = tone(sections.score);
  const done = SEGMENTS.filter((s) => sections[s.key]).length;

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-heading text-base font-semibold text-primary">{tr('completenessTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {tr('progressLabel', { done, total: SEGMENTS.length })}
          </p>
        </div>
        <span className={cn('inline-flex items-baseline gap-0.5 font-heading text-2xl font-bold', t.text)}>
          {sections.score}
          <span className="text-sm font-semibold">%</span>
        </span>
      </div>

      <div className="relative mb-4 h-2.5 overflow-hidden rounded-full bg-border-light">
        <div
          className={cn('relative h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', t.bar)}
          style={{ width: `${Math.max(2, sections.score)}%` }}
        >
          {sections.score > 0 && sections.score < 100 ? (
            <span className="stripe-progress absolute inset-0" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(({ key, href }) => {
          const complete = sections[key];
          const label = tr(`sections.${key}` as 'sections.personal');
          return (
            <Link
              key={key}
              href={href}
              aria-label={`${label} — ${complete ? tr('ringComplete') : ''}`.trim()}
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:-translate-y-0.5',
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

      {sections.score < 100 ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          {tr('whyItMatters')}
        </p>
      ) : null}
    </div>
  );
}
