import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoFallback } from '@/components/shared';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { resolvePhotoUrl } from '@/lib/photo';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<import('next').Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shortlist.metadata' });
  return { title: t('title') };
}

interface ShortlistItem {
  id:                 string;
  profileId:          string;
  targetProfileId:    string;
  note:               string | null;
  createdAt:          string;
  name:               string | null;
  age:                number | null;
  city:               string | null;
  primaryPhotoKey:    string | null;
  verificationStatus: string;
}

interface PaginatedShortlists {
  items: ShortlistItem[];
  total: number;
  page:  number;
  limit: number;
}

async function fetchShortlist(token: string): Promise<PaginatedShortlists | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/matchmaking/shortlists/mine?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: PaginatedShortlists };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function ShortlistPage() {
  const t = await getTranslations('shortlist');
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const result = await fetchShortlist(token);
  const items = result?.items ?? [];

  return (
    <main className="min-h-screen bg-background">
      <PageTransition className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <PageHeader
          title={t('heading')}
          subtitle={items.length > 0 ? t('subtitleCount', { count: items.length }) : t('subtitleEmpty')}
        />

        {items.length === 0 ? (
          <EmptyState
            variant="no-shortlist"
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
            {items.map((item) => {
              const photoUrl = resolvePhotoUrl(item.primaryPhotoKey);
              const name = item.name ?? 'Profile';
              return (
                <Card key={item.id} className="group overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                  <Link href={`/profiles/${item.targetProfileId}`} className="relative block aspect-[4/5]">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={`${name}'s profile photo`}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <PhotoFallback name={name} />
                    )}
                    <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/70" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10">
                      <p className="font-heading text-sm font-semibold text-white">
                        {name}{item.age != null ? <span className="font-normal text-white/80">, {item.age}</span> : null}
                      </p>
                      <p className="truncate text-xs text-white/75">{item.city ?? ''}</p>
                    </div>
                    {item.verificationStatus === 'VERIFIED' ? (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-1.5 py-0.5 text-2xs font-bold text-success shadow-sm">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Verified
                      </span>
                    ) : null}
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
