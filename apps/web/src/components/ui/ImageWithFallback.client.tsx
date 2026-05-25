'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { InitialAvatar } from '@/components/ui/InitialAvatar';

type ImageWithFallbackProps = Omit<ImageProps, 'src' | 'onError' | 'onLoad'> & {
  src: string | null | undefined;
  wrapperClassName?: string;
  name?: string | null;
  /** Retained for back-compat; ignored — InitialAvatar handles its own sizing. */
  initialSizeClass?: string;
};

/**
 * next/image wrapper with: warm shimmer skeleton while loading and a
 * canonical InitialAvatar fallback for empty/error states. The fallback
 * size adapts to the wrapper because InitialAvatar takes `h-full w-full`
 * via className.
 */
export function ImageWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  fill,
  name,
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
        <span className="absolute inset-0 block">
          <InitialAvatar
            name={name ?? null}
            size="xl"
            shape="square"
            className="h-full w-full rounded-none"
          />
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
