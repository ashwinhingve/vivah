import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import {
  ShieldCheck, Users, Sparkles, UserPlus, Bell, UserCog, Cake, Clock,
} from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { getMyLinks, getDraftedActions, type DraftedAction } from '@/lib/family-mode-api';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { AssistedSeekerCard } from '@/components/family/AssistedSeekerCard';
import { FamilyMembersClient } from '@/components/family/FamilyMembersClient.client';
import { RequestFamilyVerification } from '@/components/family/RequestFamilyVerification.client';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';
import type { FamilyView, FamilyVerificationBadge } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

const BADGE_LABEL: Record<FamilyVerificationBadge, string> = {
  NONE:            'Not verified',
  FAMILY_VERIFIED: 'Family verified',
  PARENT_VERIFIED: 'Parent verified',
};

export default async function FamilyPage() {
  // Role guard — middleware does the same check, but the page guard prevents
  // any leak if matcher config drifts.
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'FAMILY_MEMBER' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const cookieStore = await cookies();
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const [links, drafted, familyView] = await Promise.all([
    getMyLinks(cookieHeader),
    getDraftedActions(cookieHeader),
    fetchAuth<FamilyView>('/api/v1/profiles/me/family'),
  ]);

  const approvedAsParent = (links?.as_parent ?? []).filter(
    (l) => l.childConsentStatus === 'APPROVED' && !l.revokedAt,
  );
  const allDrafted = drafted ?? [];
  const pendingDrafted = allDrafted.filter((a) => a.status === 'PENDING');
  const countPendingFor = (childUserId: string) =>
    pendingDrafted.filter((a) => a.childUserId === childUserId).length;

  const verification = familyView?.verification ?? null;
  const score = familyView?.inclinationScore ?? 0;

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl space-y-7 px-4 py-6 pb-24 lg:max-w-4xl">

          {/* ── Hero greeting ──────────────────────────────────── */}
          <FadeUp delay={0}>
            <div className="relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 via-surface to-gold/10 px-5 py-5 shadow-card sm:px-7 sm:py-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
              />
              <h1 className="relative font-heading text-[22px] font-semibold leading-tight tracking-tight text-primary sm:text-[28px]">
                Family hub 👨‍👩‍👧
              </h1>
              <p className="relative mt-1.5 text-sm text-muted-foreground">
                Assist family members with matchmaking and collaborate on their weddings —
                every action they didn't do themselves needs their approval.
              </p>
            </div>
          </FadeUp>

          {/* ── KPI row ────────────────────────────────────────── */}
          <StaggerList className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
            <StatsCard
              label="Seekers I assist"
              value={approvedAsParent.length}
              sub="Approved links"
              icon={Users}
              variant="teal"
              animDelayMs={0}
              href="/family/parent-mode"
              emptyCta={{ label: 'Link a family member', href: '/family/link/new' }}
            />
            <StatsCard
              label="Pending drafted actions"
              value={pendingDrafted.length}
              sub="Awaiting their approval"
              icon={Clock}
              variant="gold"
              animDelayMs={100}
              href="/family/parent-mode"
            />
            <StatsCard
              label="Family verification"
              value={verification ? BADGE_LABEL[verification.badge] : 'Not verified'}
              sub={verification?.verifiedAt ? `Since ${new Date(verification.verifiedAt).toLocaleDateString()}` : 'From your family details'}
              icon={ShieldCheck}
              variant={verification?.isVerified ? 'success' : 'default'}
              animDelayMs={200}
            />
            <StatsCard
              label="Family signal score"
              value={score}
              sub="Out of 100"
              icon={Sparkles}
              variant={score >= 60 ? 'success' : 'default'}
              animDelayMs={300}
            />
          </StaggerList>

          {/* ── Pillar 1 — Guardian matchmaking co-pilot ────────── */}
          <FadeUp delay={0.1}>
            <SectionHeader
              title="Seekers you assist"
              viewAllHref="/family/parent-mode"
              viewAllLabel="Manage all"
            />
            {approvedAsParent.length === 0 ? (
              <EmptyState
                icon={Users}
                title="You're not linked to anyone yet"
                description="Once a family member approves your link request, you can help them browse matches and draft interests on their behalf."
                action={
                  <Link
                    href="/family/link/new"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal px-4 text-sm font-medium text-white hover:bg-teal-hover"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Link a family member
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {approvedAsParent.map((l) => (
                  <AssistedSeekerCard key={l.id} link={l} pendingCount={countPendingFor(l.childUserId)} />
                ))}
              </div>
            )}
          </FadeUp>

          {/* ── Pending items across all seekers ────────────────── */}
          <FadeUp delay={0.15}>
            <SectionHeader title="Pending items" />
            {pendingDrafted.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nothing pending"
                description="Drafted interests and messages you send on a seeker's behalf will wait here until they respond."
              />
            ) : (
              <ul className="space-y-3">
                {pendingDrafted.slice(0, 5).map((a: DraftedAction) => (
                  <li key={a.id}><ParentActionCard action={a} /></li>
                ))}
              </ul>
            )}
          </FadeUp>

          {/* ── Pillar 2 — Wedding-planning collaborator ────────── */}
          <FadeUp delay={0.2}>
            <SectionHeader title="Weddings you collaborate on" />
            <EmptyState
              icon={Cake}
              title="No wedding collaborations yet"
              description="Weddings you're invited to help plan will appear here with a direct link into the shared planner, once you're added as a collaborator."
            />
          </FadeUp>

          {/* ── Quick actions ────────────────────────────────────── */}
          <FadeUp delay={0.25}>
            <SectionHeader title="Quick actions" />
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
              <Link
                href="/family/link/new"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-teal/20 bg-teal/5 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-teal/10 hover:shadow-card-hover"
              >
                <UserPlus className="h-5 w-5 text-teal" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  Link a family member
                </span>
              </Link>
              <Link
                href="/family/inbox"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-gold/30 bg-gold/10 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-gold/20 hover:shadow-card-hover"
              >
                <Bell className="h-5 w-5 text-gold-muted" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  Family inbox
                </span>
              </Link>
              <Link
                href="/family/parent-mode"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary/10 hover:shadow-card-hover"
              >
                <UserCog className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  Parent mode
                </span>
              </Link>
            </div>
          </FadeUp>

          {/* ── Family details & roster (kept reachable) ─────────── */}
          <FadeUp delay={0.3}>
            <SectionHeader title="Your family details" />
            {familyView ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <Field label="Father">{familyView.section.fatherName ?? '—'}{familyView.section.fatherOccupation ? ` · ${familyView.section.fatherOccupation}` : ''}</Field>
                    <Field label="Mother">{familyView.section.motherName ?? '—'}{familyView.section.motherOccupation ? ` · ${familyView.section.motherOccupation}` : ''}</Field>
                    <Field label="Family type">{familyView.section.familyType ?? '—'}</Field>
                    <Field label="Family values">{familyView.section.familyValues ?? '—'}</Field>
                    <Field label="Native place">{familyView.section.nativePlace ?? '—'}</Field>
                    <Field label="Family status">{familyView.section.familyStatus ?? '—'}</Field>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Edit details from <Link href="/profile/family" className="text-teal underline">profile family page</Link>.
                  </p>
                  <RequestFamilyVerification verified={verification?.isVerified ?? false} />
                </div>
                <FamilyMembersClient initial={familyView.members} />
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Family profile details not available"
                description="This structured family bio applies to accounts with their own matchmaking profile."
              />
            )}
          </FadeUp>

        </div>
      </main>
    </PageTransition>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
