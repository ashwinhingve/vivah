import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Users2, ArrowLeft, Scale } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { fetchAuth } from '@/lib/server-fetch';
import { getChildCandidates, resolveNames } from '@/lib/family-mode-api';
import { resolvePhotoUrl } from '@/lib/photo';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProfileCard } from '@/components/ui/ProfileCard.client';
import { DraftInterestButton } from '@/components/family/DraftInterestButton.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('familyRole');
  return { title: t('browseTitle') };
}

export default async function FamilyBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ childUserId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'FAMILY_MEMBER' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const t = await getTranslations('familyRole');

  const { childUserId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const cookieStore = await cookies();
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const [candidates, resolved] = await Promise.all([
    getChildCandidates(childUserId, page, cookieHeader),
    resolveNames({ userIds: [childUserId] }, cookieHeader),
  ]);

  // A null candidates response means no active link (403) or no feed yet.
  const items = candidates?.items ?? [];
  const total = candidates?.total ?? 0;
  const seekerName = resolved?.users.find((u) => u.userId === childUserId)?.name ?? 'your family member';

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 pb-24">
        <FadeUp>
          <Link
            href="/family/parent-mode"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Parent mode
          </Link>
        </FadeUp>

        <RoleHero
          icon={Users2}
          title={t('browseTitle')}
          subtitle={`Curated matches for ${seekerName}. Draft an interest — they approve it from their inbox before anything is sent.`}
        />

        <div className="mt-6">
          {candidates === null ? (
            <FadeUp>
              <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
                <EmptyState
                  variant="no-matches"
                  title="Can’t browse right now"
                  description="You need an approved link with this family member, or their matches aren’t ready yet."
                  actionLabel="Back to parent mode"
                  actionHref="/family/parent-mode"
                />
              </div>
            </FadeUp>
          ) : items.length === 0 ? (
            <FadeUp>
              <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
                <EmptyState variant="no-matches" description="No curated matches yet. Check back as their profile strengthens." />
              </div>
            </FadeUp>
          ) : (
            <>
              <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => (
                  <div key={c.profileId} className="space-y-2">
                    <Link href={`/profiles/${c.profileId}`} className="block">
                      <ProfileCard
                        name={c.name || 'Member'}
                        age={c.age}
                        city={c.city}
                        photoUrl={c.photoHidden ? null : resolvePhotoUrl(c.photoKey)}
                        isNew={c.isNew}
                        isVerified={c.isVerified}
                        compatibilityPct={c.compatibility?.totalScore}
                        manglik={c.manglik ?? null}
                        lastActiveAt={c.lastActiveAt ?? null}
                        distanceKm={c.distanceKm ?? null}
                      />
                    </Link>
                    <DraftInterestButton
                      childUserId={childUserId}
                      targetProfileId={c.profileId}
                      candidateName={c.name || 'this member'}
                    />
                    <Link
                      href={`/family/compatibility/${c.profileId}?childUserId=${childUserId}`}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-teal hover:underline"
                    >
                      <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                      See family compatibility
                    </Link>
                  </div>
                ))}
              </StaggerList>

              {/* Pagination */}
              {total > items.length && (
                <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
                  {page > 1 && (
                    <Link
                      href={`/family/browse/${childUserId}?page=${page - 1}`}
                      className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm text-primary hover:border-gold/40"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="text-sm text-text-muted">Page {page}</span>
                  {page * 12 < total && (
                    <Link
                      href={`/family/browse/${childUserId}?page=${page + 1}`}
                      className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm text-primary hover:border-gold/40"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
