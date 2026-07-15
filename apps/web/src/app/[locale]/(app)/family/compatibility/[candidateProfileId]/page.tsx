import { cookies } from 'next/headers';
import { Scale, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { fetchAuth } from '@/lib/server-fetch';
import { getRatings, resolveNames } from '@/lib/family-mode-api';
import { getChildProfileId } from '@/lib/family-extras-api';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { JointScoreCard } from '@/components/family/JointScoreCard';
import { FamilyRatingForm } from '@/components/family/FamilyRatingForm.client';

interface PageProps {
  params: Promise<{ candidateProfileId: string }>;
  searchParams: Promise<{ childUserId?: string }>;
}

interface MeProfile {
  id: string;
  userId: string;
}

export default async function FamilyCompatPage({ params, searchParams }: PageProps) {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const { candidateProfileId } = await params;
  const { childUserId } = await searchParams;
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  // Two entry points: a parent opening this for a linked child's candidate
  // (subject = the child's own profile), or a seeker opening it for their
  // own match (subject = their own profile).
  let subjectProfileId: string | null;
  let seekerLabel: string;
  let backHref: string;

  if (childUserId) {
    const [resolvedSubject, resolvedName] = await Promise.all([
      getChildProfileId(childUserId, cookieHeader),
      resolveNames({ userIds: [childUserId] }, cookieHeader),
    ]);
    subjectProfileId = resolvedSubject;
    seekerLabel = resolvedName?.users.find((u) => u.userId === childUserId)?.name ?? 'your family member';
    backHref = `/family/browse/${childUserId}`;
  } else {
    const me = await fetchAuth<MeProfile>('/api/v1/profiles/me');
    subjectProfileId = me?.id ?? null;
    seekerLabel = 'you';
    backHref = '/family/parent-mode';
  }

  if (!subjectProfileId) {
    return (
      <PageTransition>
        <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 pb-24">
          <RoleHero
            icon={Scale}
            title="Family compatibility"
            subtitle="Your family's view of a match alongside the system's score."
          />
          <div className="mt-6 rounded-2xl border border-gold/20 bg-surface shadow-card">
            <EmptyState
              variant="no-matches"
              title="Nothing to rate yet"
              description="Family compatibility applies to a seeker's own matchmaking profile — open it from a candidate on the browse page."
              actionLabel="Back to parent mode"
              actionHref="/family/parent-mode"
            />
          </div>
        </main>
      </PageTransition>
    );
  }

  const data = await getRatings(subjectProfileId, candidateProfileId, cookieHeader);
  const ratings = data?.ratings ?? [];
  const joint = data?.joint ?? {
    jointScore: null, familySignalCount: 0, agreementPct: null,
    userMatchScore: null, familyAvgScore: null,
  };

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <FadeUp>
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </FadeUp>

        <RoleHero
          icon={Scale}
          title="Family compatibility"
          subtitle={`Your family's view of this match for ${seekerLabel}, alongside the system's score.`}
        />

        <div className="mt-6 space-y-6">
          <JointScoreCard joint={joint} />

          {ratings.length > 0 && (
            <section className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6 shadow-card">
              <h2 className="text-base font-heading text-primary mb-3">Family ratings</h2>
              <ul className="divide-y divide-gold/15">
                {ratings.map((r) => (
                  <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {r.raterRelationship ?? 'Family member'}
                      </p>
                      {r.notes && <p className="text-sm text-muted-foreground mt-1">{r.notes}</p>}
                      {r.compatibilityConcerns && r.compatibilityConcerns.length > 0 && (
                        <p className="text-xs text-warning mt-1">
                          Concerns: {r.compatibilityConcerns.join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-heading text-primary">{r.overallScore}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <FamilyRatingForm
            subjectProfileId={subjectProfileId}
            candidateProfileId={candidateProfileId}
          />
        </div>
      </main>
    </PageTransition>
  );
}
