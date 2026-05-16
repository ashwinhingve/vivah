'use client';
import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

type Props = Omit<ImageProps, 'onError' | 'src'> & {
  src: string | null | undefined;
  fallback: React.ReactNode;
};

export function ProfileImage({ src, fallback, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return <Image src={src} {...props} onError={() => setFailed(true)} />;
}
