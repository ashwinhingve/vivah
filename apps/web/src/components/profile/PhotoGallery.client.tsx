'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';

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

/** Empty/protected state when the viewing user hasn't unlocked photos. */
function ProtectedPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden border-2 border-gold/20 bg-gradient-to-br from-primary/10 via-gold/10 to-teal/10 flex flex-col items-center justify-center gap-3">
      <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center">
        <Lock className="w-8 h-8 text-gold-muted" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="text-center px-6">
        <p className="font-heading text-base font-semibold text-primary">{name.split(' ')[0]}'s Photos</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Photos are protected — visible after mutual interest
        </p>
      </div>
      <div className="absolute inset-0 ring-2 ring-inset ring-gold/20 rounded-2xl pointer-events-none" aria-hidden="true" />
    </div>
  );
}

/** Full-screen lightbox overlay */
function Lightbox({
  photos,
  startIdx,
  name,
  onClose,
}: {
  photos: Photo[];
  startIdx: number;
  name: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const total = photos.length;

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  // Keyboard navigation + escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  // Touch swipe support
  useEffect(() => {
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]?.clientX ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const diff = startX - (e.changedTouches[0]?.clientX ?? 0);
      if (Math.abs(diff) > 50) { if (diff > 0) next(); else prev(); }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [prev, next]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const active = photos[idx];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${idx + 1} of ${total} — ${name}`}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
        {idx + 1} / {total}
      </div>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={prev}
          aria-label="Previous photo"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Image */}
      <div className="w-full h-full flex items-center justify-center px-16 py-16">
        {active?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={`${name} — photo ${idx + 1}`}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none"
            draggable={false}
          />
        ) : (
          <div className="w-64 h-64 rounded-full bg-gradient-to-br from-primary to-gold flex items-center justify-center">
            <span className="text-white text-7xl font-heading font-semibold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={next}
          aria-label="Next photo"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] pb-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`View photo ${i + 1}`}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors min-w-[44px] min-h-[44px] ${
                i === idx ? 'border-gold' : 'border-white/20 hover:border-white/50'
              }`}
            >
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover" aria-hidden="true" />
              ) : (
                <div className="w-full h-full bg-white/10" />
              )}
            </button>
          ))}
        </div>
      )}
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

  // If no photos at all, show protected placeholder
  if (sorted.length === 0) {
    return <ProtectedPlaceholder name={name} />;
  }

  const active = sorted[activeIdx];

  return (
    <>
      <div className="space-y-2">
        {/* Primary large photo — 4:5 */}
        <div
          className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden border-2 border-gold/20 cursor-zoom-in group"
          onClick={() => setLightboxIdx(activeIdx)}
          role="button"
          tabIndex={0}
          aria-label={`Open photo ${activeIdx + 1} fullscreen`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxIdx(activeIdx); }}
        >
          {active?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.url}
              alt={`${name}'s photo`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-gold flex items-center justify-center">
              <span className="text-white text-6xl font-heading font-semibold">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />

          {/* Verified Teal pill */}
          {isVerified && (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white shadow-md ring-2 ring-surface/40">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </div>
          )}

          {/* Photo count badge */}
          {sorted.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white font-medium backdrop-blur-sm">
              {activeIdx + 1}/{sorted.length}
            </div>
          )}

          {/* Online dot (if primary photo active) */}
          {activeIdx === 0 && (
            <div className="absolute bottom-3 left-3 h-3 w-3 rounded-full bg-success ring-2 ring-white" aria-label="Online indicator" />
          )}
        </div>

        {/* Thumbnail row — only if >1 photo */}
        {sorted.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {sorted.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors min-w-[44px] min-h-[44px] ${
                  idx === activeIdx ? 'border-gold' : 'border-gold/20 hover:border-gold/50'
                }`}
                aria-label={`View photo ${idx + 1}`}
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" aria-hidden="true" />
                ) : (
                  <div className="w-full h-full bg-border animate-pulse" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox portal */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={sorted}
          startIdx={lightboxIdx}
          name={name}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}
