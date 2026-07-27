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
 * Detect if a URL is a presigned/expiring R2 URL that should not be optimized.
 * Presigned URLs contain query params like X-Amz-Signature, X-Amz-Expires, etc.
 */
function isPresignedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.has('X-Amz-Signature') || urlObj.searchParams.has('X-Amz-Expires');
  } catch {
    return false;
  }
}

/**
 * next/image wrapper with: warm shimmer skeleton while loading and a
 * canonical InitialAvatar fallback for empty/error states. The fallback
 * size adapts to the wrapper because InitialAvatar takes `h-full w-full`
 * via className.
 *
 * For presigned/expiring R2 URLs, uses unoptimized <img> to preserve the
 * pre-signed query parameters and avoid cache issues with time-limited URLs.
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
  const isPresigned = src ? isPresignedUrl(src) : false;

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
      ) : isPresigned ? (
        // For presigned URLs, use a plain img tag to avoid optimization that would strip query params
        <img
          src={src}
          alt={alt}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
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
