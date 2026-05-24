'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  /** Resolved photo URLs (not storage keys). Pass an empty array to hide. */
  urls: string[];
  /** Starting index. `null` keeps the modal closed. */
  startIdx: number | null;
  /** Image alt text — formatted as "{alt} — photo N". */
  alt: string;
  onClose: () => void;
}

/**
 * Shared full-screen lightbox modal used by ProfilePhotoGallery and
 * (eventually) the chat photo viewer. URL-based (not storage-key based) so
 * callers convert keys to URLs before passing them in.
 *
 * - Keyboard: Esc closes, ←/→ paginate.
 * - Touch: horizontal swipe paginates.
 * - Locks body scroll while open.
 * - AnimatePresence handles enter/exit cross-fade.
 */
export function PhotoLightboxModal({ urls, startIdx, alt, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const total = urls.length;
  const open = startIdx !== null && total > 0;

  useEffect(() => {
    if (startIdx !== null) setIdx(Math.max(0, Math.min(startIdx, total - 1)));
  }, [startIdx, total]);

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, prev, next]);

  useEffect(() => {
    if (!open) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]?.clientX ?? 0; };
    const onTouchEnd = (e: TouchEvent) => {
      const diff = startX - (e.changedTouches[0]?.clientX ?? 0);
      if (Math.abs(diff) > 50) (diff > 0 ? next : prev)();
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, prev, next]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  const active = open ? urls[idx] : null;

  return (
    <AnimatePresence>
      {open && active ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${idx + 1} of ${total} — ${alt}`}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close lightbox"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
            {idx + 1} / {total}
          </div>

          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}

          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex max-h-[80vh] max-w-[90vw] items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active}
              alt={`${alt} — photo ${idx + 1}`}
              className="max-h-[80vh] max-w-full select-none rounded-xl object-contain shadow-2xl"
              draggable={false}
            />
          </motion.div>

          {total > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
