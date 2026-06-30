'use client';

import { BadgeCheck, Bookmark, Heart, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from './ImageWithFallback.client';

/**
 * Presentational matrimonial profile card. Fully stateless — every
 * interaction is lifted to the parent via callbacks. Mirrors the shape of
 * `MatchFeedItem` (packages/types) without importing it, so it stays a pure
 * client primitive. Labels come from the `matchCard` i18n namespace; the card
 * is always rendered under the [locale] NextIntl provider.
 */
export interface ProfileCardProps {
  name: string;
  age?: number | null;
  city?: string | null;
  profession?: string | null;
  photoUrl?: string | null;
  isNew?: boolean;
  isVerified?: boolean;
  /** Reserved — not currently surfaced (no online signal in MatchFeedItem). */
  isOnline?: boolean;
  /** 0–100 compatibility. Renders the teal hero score badge when set. */
  compatibilityPct?: number | null;
  /** 0–36 Guna. Renders the gold "x/36 Guna" chip when set. */
  gunaScore?: number | null;
  shortlisted?: boolean;
  onShortlist?: () => void;
  onConnect?: () => void;
  onPass?: () => void;
  /** Whole-card click (e.g. open profile). Action buttons stop propagation. */
  onOpen?: () => void;
  className?: string;
}

/** Map a 0–100 compatibility score to a tier key in `matchCard.tiers`. */
function scoreTier(pct: number): 'excellent' | 'good' | 'average' | 'low' {
  if (pct >= 90) return 'excellent';
  if (pct >= 70) return 'good';
  if (pct >= 50) return 'average';
  return 'low';
}

function ProfileCardBase({
  name,
  age,
  city,
  profession,
  photoUrl,
  isNew,
  isVerified,
  compatibilityPct,
  gunaScore,
  shortlisted,
  onShortlist,
  onConnect,
  onPass,
  onOpen,
  className,
}: ProfileCardProps) {
  const t = useTranslations('matchCard');
  const meta = [age ? `${age}` : null, city, profession].filter(Boolean).join(' · ');
  const pct = compatibilityPct != null ? Math.round(compatibilityPct) : null;
  const tierLabel = pct != null ? t(`tiers.${scoreTier(pct)}`) : null;

  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-card-hover',
        className
      )}
    >
      <div
        className={cn('relative', onOpen && 'cursor-pointer')}
        onClick={onOpen}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onKeyDown={(e) => {
          if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <ImageWithFallback
          src={photoUrl}
          alt={name}
          name={name}
          initialSizeClass="text-[56px]"
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          wrapperClassName="aspect-[4/5] w-full"
        />

        {/* Bottom 40% legibility scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />

        {/* Top-left: compatibility hero badge — the primary scan signal */}
        {pct != null && (
          <div
            className="absolute left-3 top-3 flex flex-col items-start rounded-lg bg-teal/95 px-2.5 py-1.5 text-white shadow-sm backdrop-blur-sm"
            aria-label={t('percentMatch', { percent: pct })}
          >
            <span className="font-heading text-base font-bold leading-none">{pct}%</span>
            {tierLabel && (
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85">
                {tierLabel}
              </span>
            )}
          </div>
        )}

        {/* Top-right: verified + new, stacked */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {isVerified && (
            <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('verified')}
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
              {t('new')}
            </span>
          )}
        </div>

        {/* Name + meta over scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <h3 className="font-heading text-lg font-semibold leading-tight text-white">
            {name}
          </h3>
          {meta && <p className="mt-0.5 text-[13px] text-white/85">{meta}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {gunaScore != null && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-muted">
              {t('gunaScore', { score: Math.round(gunaScore) })}
            </span>
          </div>
        )}

        {/* Actions — secondary icons (Shortlist · Pass) above the full-width
            primary Connect. Two rows so all targets stay ≥44px even on a
            2-column 375px card where one row can't fit three. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={shortlisted ? t('removeShortlist') : t('shortlist')}
              aria-pressed={shortlisted}
              onClick={stop(onShortlist)}
              className={cn(
                'flex h-11 flex-1 items-center justify-center rounded-lg border transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                shortlisted
                  ? 'border-gold bg-gold/15 text-gold-muted'
                  : 'border-border text-text-muted hover:border-gold/50 hover:text-gold-muted'
              )}
            >
              <Bookmark className={cn('h-[18px] w-[18px]', shortlisted && 'fill-gold')} />
            </button>

            <button
              type="button"
              aria-label={t('pass')}
              onClick={stop(onPass)}
              className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-border hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <button
            type="button"
            aria-label={t('connect')}
            onClick={stop(onConnect)}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all duration-100 ease-out hover:-translate-y-px hover:bg-teal-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Heart className="h-4 w-4" />
            {t('connect')}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Loading placeholder with the same footprint as a ProfileCard. */
function ProfileCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card',
        className
      )}
      aria-hidden="true"
    >
      <div className="skeleton-warm aspect-[4/5] w-full" />
      <div className="flex flex-col gap-3 p-3.5">
        <div className="flex gap-2">
          <div className="skeleton-warm h-6 w-24 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="skeleton-warm h-11 flex-1 rounded-lg" />
            <div className="skeleton-warm h-11 flex-1 rounded-lg" />
          </div>
          <div className="skeleton-warm h-11 w-full rounded-lg" />
        </div>
      </div>
    </article>
  );
}

export const ProfileCard = Object.assign(ProfileCardBase, {
  Skeleton: ProfileCardSkeleton,
});
