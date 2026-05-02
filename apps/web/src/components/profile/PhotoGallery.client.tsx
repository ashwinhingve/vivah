'use client';
import { useState } from 'react';

interface Photo {
  id: string;
  url?: string;
  r2Key: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface Props {
  photos: Photo[];
  name: string; // for alt text
}

export function PhotoGallery({ photos, name }: Props) {
  const sorted = [...photos].sort((a, b) => {
    if (a.isPrimary) return -1;
    if (b.isPrimary) return 1;
    return a.displayOrder - b.displayOrder;
  });

  const [activeIdx, setActiveIdx] = useState(0);
  const active = sorted[activeIdx];

  return (
    <div className="space-y-2">
      {/* Main photo */}
      <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border-2 border-gold">
        {active?.url ? (
          <img src={active.url} alt={`${name}&#39;s photo`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          // Warm gradient fallback with initials
          <div className="w-full h-full bg-gradient-to-br from-primary to-gold flex items-center justify-center">
            <span className="text-white text-6xl font-['Playfair_Display'] font-semibold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail strip — only if >1 photo */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {sorted.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={() => setActiveIdx(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors min-w-[44px] min-h-[44px] ${
                idx === activeIdx ? 'border-gold' : 'border-border hover:border-gold/50'
              }`}
              aria-label={`View photo ${idx + 1}`}>
              {photo.url ? (
                <img src={photo.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" aria-hidden="true" />
              ) : (
                <div className="w-full h-full bg-border animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
