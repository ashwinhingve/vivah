'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImageWithFallbackProps = Omit<ImageProps, 'src' | 'onError' | 'onLoad'> & {
  src: string | null | undefined;
  /** Wrapper className — size/aspect lives here when using `fill`. */
  wrapperClassName?: string;
};

/**
 * next/image wrapper with: warm shimmer skeleton while loading, graceful
 * error/empty fallback (gold tint + UserCircle), object-cover default, and a
 * 200ms opacity fade-in on load. Used for every profile / vendor / ceremony
 * photo so a broken or missing image never shows a torn icon.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  fill,
  ...props
}: ImageWithFallbackProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <span className={cn('relative block overflow-hidden bg-surface-muted', wrapperClassName)}>
      {!showFallback && !loaded && (
        <span className="skeleton-warm absolute inset-0 block" aria-hidden="true" />
      )}

      {showFallback ? (
        <span
          className="absolute inset-0 flex items-center justify-center bg-gold/20"
          aria-hidden="true"
        >
          <UserCircle className="h-1/3 w-1/3 min-h-8 min-w-8 text-gold-muted/60" strokeWidth={1.25} />
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          className={cn(
            'object-cover transition-opacity duration-200 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          {...props}
        />
      )}
    </span>
  );
}
