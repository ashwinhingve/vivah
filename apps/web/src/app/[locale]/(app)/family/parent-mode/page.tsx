import { cookies } from 'next/headers';
import { UserCog, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks, getDraftedActions, resolveNames } from '@/lib/family-mode-api';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AssistedSeekerCard } from '@/components/family/AssistedSeekerCard';

export const metadata = { title: 'Parent mode' };
export const dynamic = 'force-dynamic';

export default async function ParentModeDashboardPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const [links, drafted] = await Promise.all([
    getMyLinks(cookieHeader),
    getDraftedActions(cookieHeader),
  ]);

  const asParent = links?.as_parent ?? [];
  const asChild  = links?.as_child  ?? [];

  const approvedAsParent = asParent.filter(
    (l) => l.childConsentStatus === 'APPROVED' && !l.revokedAt,
  );
  const pendingDrafted = (drafted ?? []).filter((a) => a.status === 'PENDING');
  const countPendingFor = (childUserId: string) =>
    pendingDrafted.filter((a) => a.childUserId === childUserId).length;

  // Humanize every userId this page shows — the child accounts we assist,
  // and the parent accounts that manage us.
  const userIds = Array.from(new Set([
    ...approvedAsParent.map((l) => l.childUserId),
    ...asChild.map((l) => l.parentUserId),
  ]));
  const resolved = userIds.length ? await resolveNames({ userIds }, cookieHeader) : null;
  const names: Record<string, string | null> = {};
  for (const u of resolved?.users ?? []) names[u.userId] = u.name;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <RoleHero
          icon={UserCog}
          title="Parent mode"
          subtitle="Browse matches and draft interests for family members you're linked to — nothing is sent until they approve it."
        />

        <div className="mt-6">
          <SectionHeader title="Family members you assist" />
          {approvedAsParent.length === 0 ? (
            <FadeUp>
              <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
                <EmptyState
                  variant="no-matches"
                  title="You're not linked to anyone yet"
                  description="Linking is parent-initiated: send a link request to a family member's account, and once they approve it from their inbox, they'll appear here."
                  actionLabel="Link a family member"
                  actionHref="/family/link/new"
                />
              </div>
            </FadeUp>
          ) : (
            <StaggerList className="space-y-3">
              {approvedAsParent.map((l) => (
                <AssistedSeekerCard
                  key={l.id}
                  link={l}
                  pendingCount={countPendingFor(l.childUserId)}
                  name={names[l.childUserId]}
                />
              ))}
            </StaggerList>
          )}
        </div>

        {asChild.length > 0 && (
          <div className="mt-8">
            <SectionHeader title="Your family managers" />
            <StaggerList className="space-y-3">
              {asChild.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-surface p-4 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {names[l.parentUserId] ?? `${l.relationship.charAt(0)}${l.relationship.slice(1).toLowerCase()}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gold-muted">
                      {l.relationship.charAt(0)}{l.relationship.slice(1).toLowerCase()} ·{' '}
                      {l.permissions.replace(/_/g, ' ').toLowerCase()} · {l.childConsentStatus.toLowerCase()}
                    </p>
                  </div>
                  {l.childConsentStatus === 'PENDING' && (
                    <Link
                      href={`/family/link-request/${l.id}`}
                      className="shrink-0 inline-flex min-h-[44px] items-center rounded-lg border border-primary/25 px-3 text-sm font-medium text-primary hover:bg-primary/5"
                    >
                      Review
                    </Link>
                  )}
                </div>
              ))}
            </StaggerList>
          </div>
        )}

        <div className="mt-8">
          <FadeUp>
            <div className="flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-muted" aria-hidden="true" />
              <p className="text-xs text-muted-foreground">
                Every interest, message or profile edit you draft on behalf of a family member sits in
                their inbox for approval — you can never take an action they haven&apos;t consented to.
              </p>
            </div>
          </FadeUp>
        </div>
      </main>
    </PageTransition>
  );
}
