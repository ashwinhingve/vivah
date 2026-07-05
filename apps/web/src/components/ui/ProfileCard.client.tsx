'use client';

import { BadgeCheck, Bookmark, CheckCircle2, Heart, MapPin, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from './ImageWithFallback.client';
import { ManglikChip } from '@/components/profile/ManglikChip';
import { LastActiveBadge } from '@/components/profile/LastActiveBadge';
import { DistancePill } from '@/components/profile/DistancePill';

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
  /** Shows an "Interest Sent" pill in the top-right stack. */
  requestSent?: boolean;
  /** Reserved — not currently surfaced (no online signal in MatchFeedItem). */
  isOnline?: boolean;
  /** 0–100 compatibility. Renders the gold-ringed score medallion when set. */
  compatibilityPct?: number | null;
  /** 0–36 Guna. Renders the gold "x/36 Guna" chip when set. */
  gunaScore?: number | null;
  /** Astrology status — renders a ManglikChip in the meta strip when set. */
  manglik?: 'YES' | 'NO' | 'PARTIAL' | null;
  /** Last-active timestamp — renders a presence badge when set. */
  lastActiveAt?: string | Date | null;
  /** Distance in km — renders a "Xkm away" chip when under 50km. */
  distanceKm?: number | null;
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
  requestSent,
  compatibilityPct,
  gunaScore,
  manglik,
  lastActiveAt,
  distanceKm,
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
  const hasMetaStrip =
    gunaScore != null || !!manglik || !!lastActiveAt || distanceKm != null;

  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:border-gold/40 hover:shadow-card-hover',
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
          fill
          quality={82}
          sizes="(max-width:640px) 100vw, (max-width:768px) 50vw, (max-width:1280px) 33vw, 240px"
          className="object-[center_30%] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          wrapperClassName="aspect-[4/5] w-full"
        />

        {/* Legibility scrim — taller & smoother so the name always reads */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

        {/* Top-left signature: gold-ringed compatibility medallion. Solid-ish
            ivory backing keeps the burgundy figure AA-legible over any photo. */}
        {pct != null && (
          <div
            className="absolute left-3 top-3 flex flex-col items-start rounded-xl bg-surface/90 px-2.5 py-1.5 shadow-md ring-1 ring-gold/60 backdrop-blur-md"
            aria-label={t('percentMatch', { percent: pct })}
          >
            <span className="font-heading text-lg font-bold leading-none text-primary">
              {pct}
              <span className="align-top text-[11px] font-semibold text-gold-muted">%</span>
            </span>
            {tierLabel && (
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-gold-muted">
                {tierLabel}
              </span>
            )}
          </div>
        )}

        {/* Top-right: status pills, stacked — request-sent first, then trust */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {requestSent && (
            <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('interestSent')}
            </span>
          )}
          {isVerified && (
            <span className="flex items-center gap-1 rounded-full bg-teal/95 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('verified')}
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-gold/95 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm backdrop-blur">
              {t('new')}
            </span>
          )}
        </div>

        {/* Name + meta over scrim */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-heading text-xl font-semibold leading-tight text-white drop-shadow-sm">
            {name}
          </h3>
          {meta && (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-white/85">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/65" aria-hidden="true" />
              <span className="truncate">{meta}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {hasMetaStrip && (
          <div className="flex flex-wrap items-center gap-1.5">
            {gunaScore != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-muted">
                {t('gunaScore', { score: Math.round(gunaScore) })}
              </span>
            )}
            <ManglikChip manglik={manglik} size="xs" />
            <DistancePill distanceKm={distanceKm ?? null} fallbackCity={null} />
            <LastActiveBadge lastActiveAt={lastActiveAt ?? null} />
          </div>
        )}

        {/* Actions — one row: Pass · Connect (primary) · Shortlist. Mobile is
            now 1-col (wide) and the narrowest desktop column is ~225px, where
            44 + Connect + 44 still fits; Connect gets min-w-0 + truncate so a
            wide label (e.g. Hindi "कनेक्ट करें") never clips a neighbour. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('pass')}
            onClick={stop(onPass)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <X className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            aria-label={t('connect')}
            onClick={stop(onConnect)}
            className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-hover text-sm font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Heart className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('connect')}</span>
          </button>

          <button
            type="button"
            aria-label={shortlisted ? t('removeShortlist') : t('shortlist')}
            aria-pressed={shortlisted}
            onClick={stop(onShortlist)}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              shortlisted
                ? 'border-gold bg-gold/15 text-gold-muted'
                : 'border-border text-muted-foreground hover:border-gold/50 hover:text-gold-muted'
            )}
          >
            <Bookmark className={cn('h-[18px] w-[18px]', shortlisted && 'fill-gold')} />
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
        <div className="flex gap-1.5">
          <div className="skeleton-warm h-6 w-20 rounded-full" />
          <div className="skeleton-warm h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton-warm h-11 w-11 rounded-lg" />
          <div className="skeleton-warm h-11 flex-1 rounded-lg" />
          <div className="skeleton-warm h-11 w-11 rounded-lg" />
        </div>
      </div>
    </article>
  );
}

export const ProfileCard = Object.assign(ProfileCardBase, {
  Skeleton: ProfileCardSkeleton,
});
