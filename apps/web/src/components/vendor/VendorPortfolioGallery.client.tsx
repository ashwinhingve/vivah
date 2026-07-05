'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolvePhotoUrl } from '@/lib/photo';
import { PhotoLightboxModal } from '@/components/ui/PhotoLightboxModal.client';

interface Props {
  photoKeys: string[];
  vendorName: string;
}

/**
 * Vendor portfolio gallery — active primary photo + thumbnail strip,
 * powered by the shared PhotoLightboxModal (Day 9). Replaces the static
 * "N photos" caption with an actual interactive gallery.
 */
export function VendorPortfolioGallery({ photoKeys, vendorName }: Props) {
  const urls = photoKeys
    .map((k) => resolvePhotoUrl(k))
    .filter((u): u is string => u !== null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  // Indices whose <img> 404'd — render the ImageOff placeholder instead of the
  // browser broken-image icon (kept index-based so activeIdx/lightbox stay stable).
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const markFailed = (idx: number) =>
    setFailed((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));

  if (urls.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-gold/5">
        <div className="text-center">
          <ImageOff className="mx-auto h-6 w-6 text-gold-muted/60" aria-hidden="true" />
          <p className="mt-1 text-xs text-muted-foreground">No portfolio photos yet</p>
        </div>
      </div>
    );
  }

  const active = urls[activeIdx]!;

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setLightboxIdx(activeIdx)}
          aria-label="Open photo fullscreen"
          className="group relative block aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-lg transition-transform duration-200 hover:scale-[1.005]"
        >
          <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl ring-1 ring-inset ring-gold/30" aria-hidden="true" />
          {failed.has(activeIdx) ? (
            <div className="flex h-full w-full items-center justify-center bg-gold/10">
              <ImageOff className="h-8 w-8 text-gold-muted/50" aria-hidden="true" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active}
              alt={`${vendorName} portfolio photo ${activeIdx + 1}`}
              loading="lazy"
              decoding="async"
              onError={() => markFailed(activeIdx)}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {activeIdx + 1}/{urls.length} · {urls.length} photo{urls.length === 1 ? '' : 's'}
          </div>
        </button>

        {urls.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {urls.map((url, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-label={`View photo ${idx + 1}`}
                  className={cn(
                    'aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-150',
                    isActive
                      ? 'scale-105 border-teal'
                      : 'border-gold/20 opacity-70 hover:opacity-100',
                  )}
                >
                  {failed.has(idx) ? (
                    <div className="flex h-full w-full items-center justify-center bg-gold/10" aria-hidden="true">
                      <ImageOff className="h-4 w-4 text-gold-muted/50" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => markFailed(idx)}
                      className="h-full w-full object-cover"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <PhotoLightboxModal
        urls={urls}
        startIdx={lightboxIdx}
        alt={`${vendorName} portfolio`}
        onClose={() => setLightboxIdx(null)}
      />
    </>
  );
}
