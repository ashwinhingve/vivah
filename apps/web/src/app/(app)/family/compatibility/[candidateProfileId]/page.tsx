import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { fetchAuth } from '@/lib/server-fetch';
import { getRatings } from '@/lib/family-mode-api';
import { JointScoreCard } from '@/components/family/JointScoreCard';
import { FamilyRatingForm } from '@/components/family/FamilyRatingForm.client';

interface PageProps {
  params: Promise<{ candidateProfileId: string }>;
}

interface MeProfile {
  id: string;
  userId: string;
}

export default async function FamilyCompatPage({ params }: PageProps) {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) redirect('/login');

  const { candidateProfileId } = await params;

  const me = await fetchAuth<MeProfile>('/api/v1/profiles/me');
  if (!me) redirect('/login');

  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const data = await getRatings(me.id, candidateProfileId, cookieHeader);

  const ratings = data?.ratings ?? [];
  const joint = data?.joint ?? {
    jointScore: null, familySignalCount: 0, agreementPct: null,
    userMatchScore: null, familyAvgScore: null,
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">Family compatibility</h1>
        <p className="text-sm text-muted-foreground">
          Your family's view of this match alongside the system's score.
        </p>
      </header>

      <JointScoreCard joint={joint} />

      {ratings.length > 0 && (
        <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6">
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
        subjectProfileId={me.id}
        candidateProfileId={candidateProfileId}
      />
    </main>
  );
}
