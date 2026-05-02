/**
 * Smart Shaadi — SimilarProfiles
 * apps/web/src/components/matchmaking/SimilarProfiles.tsx
 *
 * Server component that fetches /matchmaking/similar/:sourceId and renders a
 * horizontal scroll rail of MatchFeedItem-shaped cards.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';
import type { MatchFeedItem } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchSimilar(sourceId: string, token: string): Promise<MatchFeedItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/similar/${sourceId}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: { items: MatchFeedItem[] } };
    return json.success ? json.data.items : [];
  } catch {
    return [];
  }
}

export async function SimilarProfiles({ sourceProfileId }: { sourceProfileId: string }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  if (!token) return null;
  const items = await fetchSimilar(sourceProfileId, token);
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-primary">You may also like</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {items.map((item) => {
          const photoUrl = item.photoHidden ? null : resolvePhotoUrl(item.photoKey);
          return (
            <Card key={item.profileId} className="w-40 flex-shrink-0 overflow-hidden">
              <Link href={`/profiles/${item.profileId}`} className="relative block aspect-[4/5]">
                {photoUrl ? (
                  <Image src={photoUrl} alt={item.name} fill sizes="160px" className="object-cover" />
                ) : (
                  <PhotoFallback name={item.name || 'Member'} />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-8">
                  <p className="truncate text-xs font-semibold text-white">
                    {item.name || 'Member'}{item.age != null ? <span className="font-normal text-white/80">, {item.age}</span> : null}
                  </p>
                  <p className="truncate text-[10px] text-white/75">{item.city}</p>
                </div>
                {item.isVerified ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-surface/95 p-0.5 text-success shadow-sm">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  </span>
                ) : null}
              </Link>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
