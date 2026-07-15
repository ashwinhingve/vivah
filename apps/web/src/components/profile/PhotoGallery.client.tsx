'use client';

import { useState } from 'react';
import { Lock, BadgeCheck, ImageOff, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { PhotoLightboxModal } from '@/components/ui/PhotoLightboxModal.client';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback.client';

interface Photo {
  id: string;
  url?: string;
  r2Key: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface Props {
  photos: Photo[];
  name: string;
  isVerified?: boolean;
}

const THUMB_SLOTS = 5;

/**
 * Premium safety-mode placeholder: initialed-avatar pattern (Day 7) with a
 * backdrop-blur overlay card. Used when the viewing user hasn't unlocked
 * photos yet (e.g. no mutual interest, photoHidden = true).
 */
function ProtectedPlaceholder({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold/30 bg-gold/20 shadow-xl">
      {/* Initialed avatar layer */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-[120px] font-semibold leading-none text-primary">
          {initial}
        </span>
      </div>

      {/* Backdrop blur overlay card */}
      <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md">
        <div className="mx-6 max-w-[280px] rounded-2xl border border-gold/20 bg-surface/95 p-5 text-center shadow-card">
          <Lock className="mx-auto h-6 w-6 text-gold" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-2 font-heading text-base font-semibold text-primary">
            Photos protected by Safety Mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Unlock by mutually accepting the connection.
          </p>
          <Link
            href="/feed"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal underline-offset-2 hover:underline"
          >
            Send Interest
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PhotoGallery({ photos, name, isVerified = false }: Props) {
  const sorted = [...photos].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.displayOrder - b.displayOrder;
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (sorted.length === 0) {
    return <ProtectedPlaceholder name={name} />;
  }

  const active = sorted[activeIdx];
  const urls = sorted.map((p) => p.url ?? '').filter((u) => u !== '');
  const remainingSlots = Math.max(0, THUMB_SLOTS - sorted.length);

  return (
    <>
      <div className="space-y-3">
        {/* Primary large photo — 4:5, rounded-3xl, premium shadow */}
        <div
          className="group relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-3xl shadow-xl transition-transform duration-200 hover:scale-[1.01]"
          onClick={() => setLightboxIdx(activeIdx)}
          role="button"
          tabIndex={0}
          aria-label={`Open photo ${activeIdx + 1} fullscreen`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxIdx(activeIdx); }}
        >
          {/* Inner Gold/30 inset border */}
          <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl ring-1 ring-inset ring-gold/30" aria-hidden="true" />

          <ImageWithFallback
            src={active?.url}
            alt={`${name}'s photo`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 800px"
            wrapperClassName="absolute inset-0"
            name={name}
            className="h-full w-full object-cover"
          />

          {/* Bottom legibility scrim */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />

          {/* Verified Teal pill */}
          {isVerified && (
            <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-teal px-2.5 py-1 text-xs font-semibold text-white shadow-md ring-2 ring-surface/40">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          )}

          {/* Photo count badge */}
          {sorted.length > 1 && (
            <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {activeIdx + 1}/{sorted.length}
            </div>
          )}
        </div>

        {/* Thumbnail row — always 5 slots, dashed placeholders fill missing */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((photo, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-label={`View photo ${idx + 1}`}
                className={cn(
                  'relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-150',
                  isActive
                    ? 'scale-105 border-teal'
                    : 'border-gold/20 opacity-70 hover:opacity-100'
                )}
              >
                <ImageWithFallback
                  src={photo.url}
                  alt=""
                  fill
                  sizes="64px"
                  wrapperClassName="h-full w-full"
                  name={name}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
          {Array.from({ length: remainingSlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-square h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-gold/25 bg-gold/5"
              aria-hidden="true"
            >
              <ImageOff className="h-4 w-4 text-gold-muted/40" />
            </div>
          ))}
        </div>
      </div>

      <PhotoLightboxModal
        urls={urls}
        startIdx={lightboxIdx}
        alt={name}
        onClose={() => setLightboxIdx(null)}
      />
    </>
  );
}
