import { cookies } from 'next/headers';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PhotoFallback } from '@/components/shared';
import { resolvePhotoUrl } from '@/lib/photo';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';
  const result = await fetchShortlist(token);
  const items = result?.items ?? [];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Your Shortlist</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length > 0
              ? `${items.length} profile${items.length !== 1 ? 's' : ''} you&apos;re considering`
              : 'Save profiles you want to revisit'}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No shortlisted profiles yet"
            description="Tap the bookmark icon on any match to save them here. Your list is private — only you can see it."
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
              const name = item.name ?? 'Profile';
              return (
                <Card key={item.id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
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
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-1.5 py-0.5 text-[10px] font-bold text-success shadow-sm">
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
      </div>
    </main>
  );
}
