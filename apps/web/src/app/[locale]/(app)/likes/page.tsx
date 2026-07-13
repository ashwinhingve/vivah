/**
 * /likes — premium "who liked you" page.
 * FREE / STANDARD see blurred count + UpgradeCTA.
 * PREMIUM sees full sender details + Accept/Decline (links to /requests).
 */

import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Heart, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoFallback } from '@/components/shared';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StaggerList } from '@/components/motion/StaggerList.client';
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
  const t = await getTranslations('likes');
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
      <PageTransition className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <PageHeader
          title={t('heading')}
          subtitle={total > 0 ? t('subtitleCount', { count: total }) : t('subtitleEmpty')}
        />

        {locked && total > 0 ? (
          <UpgradeCTA
            requiredTier="PREMIUM"
            feature={t('lockedFeature', { count: total })}
            message={t('lockedMessage', { count: total })}
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
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={
              <Button asChild>
                <Link href="/feed">
                  {t('exploreCta')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        ) : (
          <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </StaggerList>
        )}
      </PageTransition>
    </main>
  );
}
