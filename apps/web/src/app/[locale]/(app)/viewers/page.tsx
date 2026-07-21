import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoFallback } from '@/components/shared';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { StatusChip } from '@/components/ui/StatusChip';
import { resolvePhotoUrl } from '@/lib/photo';
import { getEntitlementsForCurrentUser } from '@/lib/entitlements-server';
import { UpgradeCTA } from '@/components/ui/UpgradeCTA';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface RecentViewer {
  viewerProfileId:    string;
  viewedAt:           string;
  name:               string;
  age:                number | null;
  city:               string | null;
  primaryPhotoKey:    string | null;
  verificationStatus: string;
}

interface ViewersResponse {
  viewers: RecentViewer[];
  total:   number;
}

async function fetchViewers(token: string): Promise<ViewersResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/profiles/me/viewers?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: ViewersResponse };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

interface TimeAgoDescriptor {
  kind: 'justNow' | 'minutes' | 'hours' | 'days' | 'absoluteDate';
  value?: number;
  iso?: string;
}

function getTimeAgoDescriptor(iso: string): TimeAgoDescriptor {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)    return { kind: 'justNow' };
  if (mins < 60)   return { kind: 'minutes', value: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return { kind: 'hours', value: hours };
  const days = Math.floor(hours / 24);
  if (days < 30)   return { kind: 'days', value: days };
  return { kind: 'absoluteDate', iso };
}

export default async function ViewersPage() {
  const t = await getTranslations('viewers');
  const locale = await getLocale();
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const [result, entitlements] = await Promise.all([
    fetchViewers(token),
    getEntitlementsForCurrentUser(),
  ]);
  const viewers = result?.viewers ?? [];
  const isLocked = !(entitlements?.entitlements.canViewViewers ?? false);

  const formatTimeAgo = (descriptor: TimeAgoDescriptor): string => {
    switch (descriptor.kind) {
      case 'justNow':
        return t('timeAgo.justNow');
      case 'minutes':
        return descriptor.value !== undefined ? t('timeAgo.minutesAgo', { count: descriptor.value }) : '';
      case 'hours':
        return descriptor.value !== undefined ? t('timeAgo.hoursAgo', { count: descriptor.value }) : '';
      case 'days':
        return descriptor.value !== undefined ? t('timeAgo.daysAgo', { count: descriptor.value }) : '';
      case 'absoluteDate':
        return descriptor.iso
          ? new Date(descriptor.iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })
          : '';
      default:
        return '';
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <PageHeader
          title={t('heading')}
          subtitle={viewers.length > 0 ? t('subtitleCount', { count: viewers.length }) : t('subtitleEmpty')}
        />

        {isLocked && viewers.length > 0 ? (
          <UpgradeCTA
            requiredTier="STANDARD"
            feature={t('lockedFeature', { count: viewers.length })}
            message={t('lockedMessage', { count: viewers.length })}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {viewers.slice(0, 6).map((v) => {
                const photoUrl = resolvePhotoUrl(v.primaryPhotoKey);
                return (
                  <Card key={v.viewerProfileId} className="overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card">
                    <div className="relative block aspect-[4/5]">
                      {photoUrl ? (
                        <Image src={photoUrl} alt={v.name ? t('photoAlt', { name: v.name }) : t('photoAltFallback')} fill sizes="33vw" className="object-cover" />
                      ) : (
                        <PhotoFallback name={v.name} />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </UpgradeCTA>
        ) : viewers.length === 0 ? (
          <EmptyState
            variant="no-network"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {viewers.map((v) => {
              const photoUrl = resolvePhotoUrl(v.primaryPhotoKey);
              return (
                <Card key={v.viewerProfileId} className="group overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                  <Link href={`/profiles/${v.viewerProfileId}`} className="relative block aspect-[4/5]">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={v.name ? t('photoAlt', { name: v.name }) : t('photoAltFallback')}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <PhotoFallback name={v.name} />
                    )}
                    <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10">
                      <p className="font-heading text-sm font-semibold text-white">
                        {v.name}{v.age != null ? <span className="font-normal text-white/80">, {v.age}</span> : null}
                      </p>
                      <p className="truncate text-xs text-white/75">{v.city ?? ''}</p>
                    </div>
                    {v.verificationStatus === 'VERIFIED' ? (
                      <StatusChip tone="success" className="absolute right-2 top-2">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        {t('badgeVerified')}
                      </StatusChip>
                    ) : null}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-2xs font-semibold text-white shadow-sm">
                      {formatTimeAgo(getTimeAgoDescriptor(v.viewedAt))}
                    </span>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </PageTransition>
    </main>
  );
}
