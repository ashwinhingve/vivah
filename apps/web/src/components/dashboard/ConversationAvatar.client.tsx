'use client';

import { useState } from 'react';
import { InitialAvatar } from '@/components/ui/InitialAvatar';

/**
 * 40px round conversation avatar with graceful fallback.
 *
 * A raw <img> with no error handling renders the browser's broken-image icon
 * when a photo URL 404s (common in prod when a bare R2 key resolves to the
 * dev mock-r2 route). This falls back to the initials avatar instead.
 */
export function ConversationAvatar({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <InitialAvatar name={name} size="sm" shape="circle" className="h-10 w-10" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name || 'Profile photo'}
      className="h-10 w-10 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
