'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface FavoriteButtonProps {
  vendorId: string;
  initialFavorite?: boolean;
  className?: string;
}

export function FavoriteButton({ vendorId, initialFavorite = false, className = '' }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isFav;
    setIsFav(next);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/${vendorId}/favorite`, {
          method:      next ? 'POST' : 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          setIsFav(!next);
        }
      } catch {
        setIsFav(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFav}
      className={`min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full border border-gold/40 bg-surface hover:bg-gold/10 transition-colors disabled:opacity-50 ${className}`}
    >
      <Heart
        className={`h-5 w-5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-foreground'}`}
        aria-hidden="true"
      />
    </button>
  );
}
