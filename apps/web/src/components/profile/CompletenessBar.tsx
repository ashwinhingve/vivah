import Link from 'next/link';
import { Check, Circle, Sparkles } from 'lucide-react';
import type { ProfileSectionCompletion } from '@smartshaadi/types';
import { cn } from '@/lib/utils';

interface Props {
  sections: ProfileSectionCompletion;
}

const SEGMENTS: {
  key: keyof Omit<ProfileSectionCompletion, 'score'>;
  label: string;
  href: string;
}[] = [
  { key: 'personal',    label: 'Personal',    href: '/profile/personal'    },
  { key: 'photos',      label: 'Photos',      href: '/profile/photos'      },
  { key: 'family',      label: 'Family',      href: '/profile/family'      },
  { key: 'career',      label: 'Career',      href: '/profile/career'      },
  { key: 'lifestyle',   label: 'Lifestyle',   href: '/profile/lifestyle'   },
  { key: 'horoscope',   label: 'Horoscope',   href: '/profile/horoscope'   },
  { key: 'preferences', label: 'Preferences', href: '/profile/preferences' },
];

function tone(score: number) {
  if (score >= 80) return { bar: 'from-gold via-teal to-success', text: 'text-success' };
  if (score >= 50) return { bar: 'from-warning via-gold to-teal',  text: 'text-teal' };
  return { bar: 'from-destructive via-warning to-gold', text: 'text-warning' };
}

export function CompletenessBar({ sections }: Props) {
  const t = tone(sections.score);
  const done = SEGMENTS.filter((s) => sections[s.key]).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-heading text-base font-semibold text-primary">Profile Completeness</p>
          <p className="text-xs text-muted-foreground">
            {done} of {SEGMENTS.length} sections complete
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
        {SEGMENTS.map(({ key, label, href }) => {
          const complete = sections[key];
          return (
            <Link
              key={key}
              href={href}
              aria-label={`${label} — ${complete ? 'complete' : 'incomplete'}`}
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
          Complete profiles get <span className="font-semibold text-primary">3× more matches</span>
        </p>
      ) : null}
    </div>
  );
}
