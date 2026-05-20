/**
 * /likes — premium "who liked you" page.
 * FREE / STANDARD see blurred count + UpgradeCTA.
 * PREMIUM sees full sender details + Accept/Decline (links to /requests).
 */

import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';
import { getEntitlementsForCurrentUser } from '@/lib/entitlements-server';
import { UpgradeCTA } from '@/components/ui/UpgradeCTA';
import { ManglikChip } from '@/components/profile/ManglikChip';
import { LastActiveBadge } from '@/components/profile/LastActiveBadge';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface LikeItem {
  requestId: string;
  senderProfileId: string;
  message: string | null;
  createdAt: string;
  name: string | null;
  age: number | null;
  city: string | null;
  primaryPhotoKey: string | null;
  manglik: 'YES' | 'NO' | 'PARTIAL' | null;
  lastActiveAt: string | null;
  isVerified: boolean;
}

interface WhoLikedResponse {
  items: LikeItem[];
  total: number;
  locked: boolean;
  requiredTier?: 'STANDARD' | 'PREMIUM';
}

async function fetchLikes(token: string): Promise<WhoLikedResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/who-liked-me?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: WhoLikedResponse };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function LikesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const [data, entitlements] = await Promise.all([
    fetchLikes(token),
    getEntitlementsForCurrentUser(),
  ]);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const locked = data?.locked ?? !(entitlements?.entitlements.canViewWhoLikedMe ?? false);
  const showsPrecise = entitlements?.entitlements.showsPreciseLastActive ?? false;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Likes you</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total > 0 ? `${total} pending interest${total !== 1 ? 's' : ''}` : 'No new interests yet'}
          </p>
        </div>

        {locked && total > 0 ? (
          <UpgradeCTA
            requiredTier="PREMIUM"
            feature={`${total} member${total !== 1 ? 's' : ''} liked you`}
            message={`Unlock to see who's interested. Upgrade to Premium to see all ${total}.`}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/10 via-teal/10 to-gold/10">
                    <PhotoFallback name="?" />
                  </div>
                </Card>
              ))}
            </div>
          </UpgradeCTA>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No likes yet"
            description="When someone sends you an interest, you'll see them here. A complete profile attracts more interest."
            action={
              <Button asChild>
                <Link href="/feed">
                  Explore Matches
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const photoUrl = resolvePhotoUrl(item.primaryPhotoKey);
              return (
                <Card key={item.requestId} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
                  <Link href={`/profiles/${item.senderProfileId}`} className="relative block aspect-[4/5]">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={`${item.name ?? 'Member'} profile photo`}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <PhotoFallback name={item.name ?? 'Member'} />
                    )}
                    <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10">
                      <p className="font-heading text-sm font-semibold text-white">
                        {item.name ?? 'Member'}{item.age != null ? <span className="font-normal text-white/80">, {item.age}</span> : null}
                      </p>
                      <p className="truncate text-xs text-white/75">{item.city ?? ''}</p>
                    </div>
                    {item.isVerified ? (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-1.5 py-0.5 text-[10px] font-bold text-success shadow-sm">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Verified
                      </span>
                    ) : null}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 p-3 pt-2">
                    <ManglikChip manglik={item.manglik} size="xs" />
                    <LastActiveBadge lastActiveAt={item.lastActiveAt} showPrecise={showsPrecise} />
                  </div>
                  {item.message ? (
                    <p className="px-3 pb-3 text-xs italic text-muted-foreground line-clamp-2">&ldquo;{item.message}&rdquo;</p>
                  ) : null}
                  <div className="flex gap-2 p-3 pt-0">
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/requests`}>Respond</Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
