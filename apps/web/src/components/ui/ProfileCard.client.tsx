'use client';

import { BadgeCheck, Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from './ImageWithFallback.client';

/**
 * Presentational matrimonial profile card. Fully stateless — every
 * interaction is lifted to the parent via callbacks. Mirrors the shape of
 * `MatchFeedItem` (packages/types) without importing it, so it stays a pure
 * client primitive.
 */
export interface ProfileCardProps {
  name: string;
  age?: number | null;
  city?: string | null;
  profession?: string | null;
  photoUrl?: string | null;
  isNew?: boolean;
  isVerified?: boolean;
  isOnline?: boolean;
  /** 0–100 compatibility. Renders the teal "x% Match" chip when set. */
  compatibilityPct?: number | null;
  /** 0–36 Guna. Renders the burgundy "x/36 Guna" badge when set. */
  gunaScore?: number | null;
  shortlisted?: boolean;
  onShortlist?: () => void;
  onConnect?: () => void;
  onPass?: () => void;
  /** Whole-card click (e.g. open profile). Action buttons stop propagation. */
  onOpen?: () => void;
  className?: string;
}

function ActionButton({
  label,
  onClick,
  active,
  variant,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  variant: 'ghost' | 'solid';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'flex h-11 min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variant === 'solid' &&
          'bg-teal text-white shadow-sm hover:-translate-y-px hover:bg-teal-hover hover:shadow-md',
        variant === 'ghost' &&
          'text-text-muted hover:bg-surface-muted hover:text-primary',
        active && variant === 'ghost' && 'text-primary'
      )}
    >
      {children}
    </button>
  );
}

function ProfileCardBase({
  name,
  age,
  city,
  profession,
  photoUrl,
  isNew,
  isVerified,
  isOnline,
  compatibilityPct,
  gunaScore,
  shortlisted,
  onShortlist,
  onConnect,
  onPass,
  onOpen,
  className,
}: ProfileCardProps) {
  const meta = [age ? `${age}` : null, city, profession].filter(Boolean).join(' · ');

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
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          wrapperClassName="aspect-[4/5] w-full"
        />

        {/* Bottom 40% legibility scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />

        {/* Top-left: NEW / online */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {isNew && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
              New
            </span>
          )}
          {isOnline && (
            <span className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Online
            </span>
          )}
        </div>

        {/* Top-right: verified */}
        {isVerified && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            <BadgeCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        )}

        {/* Name + meta over scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <h3 className="font-heading text-lg font-semibold leading-tight text-white">
            {name}
          </h3>
          {meta && <p className="mt-0.5 text-[13px] text-white/85">{meta}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {(compatibilityPct != null || gunaScore != null) && (
          <div className="flex flex-wrap items-center gap-2">
            {compatibilityPct != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal">
                <span className="font-heading text-sm leading-none">
                  {Math.round(compatibilityPct)}%
                </span>
                Match
              </span>
            )}
            {gunaScore != null && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {Math.round(gunaScore)}/36 Guna
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <ActionButton
            label={shortlisted ? 'Remove from shortlist' : 'Shortlist'}
            onClick={onShortlist}
            active={shortlisted}
            variant="ghost"
          >
            <Heart className={cn('h-4 w-4', shortlisted && 'fill-primary text-primary')} />
          </ActionButton>
          <ActionButton label="Connect" onClick={onConnect} variant="solid">
            Connect
          </ActionButton>
          <ActionButton label="Pass" onClick={onPass} variant="ghost">
            <X className="h-4 w-4" />
          </ActionButton>
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
          <div className="skeleton-warm h-6 w-20 rounded-full" />
          <div className="skeleton-warm h-6 w-24 rounded-full" />
        </div>
        <div className="skeleton-warm h-11 w-full rounded-lg" />
      </div>
    </article>
  );
}

export const ProfileCard = Object.assign(ProfileCardBase, {
  Skeleton: ProfileCardSkeleton,
});
