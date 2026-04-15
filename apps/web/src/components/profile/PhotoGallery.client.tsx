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
      <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border-2 border-[#C5A47E]">
        {active?.url ? (
          <img src={active.url} alt={`${name}'s photo`} className="w-full h-full object-cover" />
        ) : (
          // Warm gradient fallback with initials
          <div className="w-full h-full bg-gradient-to-br from-[#7B2D42] to-[#C5A47E] flex items-center justify-center">
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
                idx === activeIdx ? 'border-[#C5A47E]' : 'border-[#E8E0D8] hover:border-[#C5A47E]/50'
              }`}
              aria-label={`View photo ${idx + 1}`}>
              {photo.url ? (
                <img src={photo.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
              ) : (
                <div className="w-full h-full bg-[#E8E0D8] animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
