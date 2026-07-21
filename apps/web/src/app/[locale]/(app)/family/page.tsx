import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getLocale } from "next-intl/server";
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import {
  ShieldCheck, Users, Sparkles, UserPlus, Bell, UserCog, Cake, Clock,
} from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { getMyLinks, getDraftedActions, type DraftedAction } from '@/lib/family-mode-api';
import { getCollaboratingWeddings } from '@/lib/family-extras-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { AssistedSeekerCard } from '@/components/family/AssistedSeekerCard';
import { FamilyMembersClient } from '@/components/family/FamilyMembersClient.client';
import { RequestFamilyVerification } from '@/components/family/RequestFamilyVerification.client';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';
import { WeddingCard } from '@/components/wedding/WeddingCard';
import type { FamilyView, FamilyVerificationBadge } from '@smartshaadi/types';

export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  // Role guard — middleware does the same check, but the page guard prevents
  // any leak if matcher config drifts.
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'FAMILY_MEMBER' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }
  const locale = await getLocale();
  const t = await getTranslations('familyRole.hub');
  const BADGE_LABEL: Record<FamilyVerificationBadge, string> = {
    NONE:            t('badgeNone'),
    FAMILY_VERIFIED: t('badgeFamilyVerified'),
    PARENT_VERIFIED: t('badgeParentVerified'),
  };

  const cookieStore = await cookies();
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const [links, drafted, familyView, collaboratingWeddings] = await Promise.all([
    getMyLinks(cookieHeader),
    getDraftedActions(cookieHeader),
    fetchAuth<FamilyView>('/api/v1/profiles/me/family'),
    getCollaboratingWeddings(cookieHeader),
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
            <PageHeader
              title={t('heroTitle')}
              subtitle={t('heroSubtitle')}
            />
          </FadeUp>

          {/* ── KPI row ────────────────────────────────────────── */}
          <StaggerList className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
            <StatsCard
              label={t('kpiSeekers')}
              value={approvedAsParent.length}
              sub={t('kpiSeekersSub')}
              icon={Users}
              variant="teal"
              animDelayMs={0}
              href="/family/parent-mode"
              emptyCta={{ label: t('linkCta'), href: '/family/link/new' }}
            />
            <StatsCard
              label={t('kpiPending')}
              value={pendingDrafted.length}
              sub={t('kpiPendingSub')}
              icon={Clock}
              variant="gold"
              animDelayMs={100}
              href="/family/parent-mode"
            />
            <StatsCard
              label={t('kpiVerification')}
              value={verification ? BADGE_LABEL[verification.badge] : t('badgeNone')}
              sub={verification?.verifiedAt ? t('kpiVerificationSince', { date: new Date(verification.verifiedAt).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN") }) : t('kpiVerificationFrom')}
              icon={ShieldCheck}
              variant={verification?.isVerified ? 'success' : 'default'}
              animDelayMs={200}
            />
            <StatsCard
              label={t('kpiScore')}
              value={score}
              sub={t('kpiScoreSub')}
              icon={Sparkles}
              variant={score >= 60 ? 'success' : 'default'}
              animDelayMs={300}
            />
          </StaggerList>

          {/* ── Pillar 1 — Guardian matchmaking co-pilot ────────── */}
          <FadeUp delay={0.1}>
            <SectionHeader
              title={t('seekersTitle')}
              viewAllHref="/family/parent-mode"
              viewAllLabel={t('seekersManageAll')}
            />
            {approvedAsParent.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('seekersEmptyTitle')}
                description={t('seekersEmptyDesc')}
                action={
                  <Link
                    href="/family/link/new"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal px-4 text-sm font-medium text-white hover:bg-teal-hover"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    {t('linkCta')}
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
            <SectionHeader title={t('pendingTitle')} />
            {pendingDrafted.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('pendingEmptyTitle')}
                description={t('pendingEmptyDesc')}
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
            <SectionHeader title={t('collabTitle')} />
            {collaboratingWeddings.length === 0 ? (
              <EmptyState
                icon={Cake}
                title={t('collabEmptyTitle')}
                description={t('collabEmptyDesc')}
              />
            ) : (
              <div className="space-y-4">
                {collaboratingWeddings.map((w) => (
                  <div key={w.id} className="space-y-1.5">
                    <WeddingCard wedding={w} />
                    <p className="px-1 text-2xs text-gold-muted">
                      {t('collabRole', { role: w.myRole === 'EDITOR' ? t('roleEditor') : t('roleViewer') })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FadeUp>

          {/* ── Quick actions ────────────────────────────────────── */}
          <FadeUp delay={0.25}>
            <SectionHeader title={t('quickTitle')} />
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
              <Link
                href="/family/link/new"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-teal/20 bg-teal/5 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-teal/10 hover:shadow-card-hover"
              >
                <UserPlus className="h-5 w-5 text-teal" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {t('linkCta')}
                </span>
              </Link>
              <Link
                href="/family/inbox"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-gold/30 bg-gold/10 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-gold/20 hover:shadow-card-hover"
              >
                <Bell className="h-5 w-5 text-gold-muted" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {t('quickInbox')}
                </span>
              </Link>
              <Link
                href="/family/parent-mode"
                className="group flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary/10 hover:shadow-card-hover"
              >
                <UserCog className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {t('quickParentMode')}
                </span>
              </Link>
            </div>
          </FadeUp>

          {/* ── Family details & roster (kept reachable) ─────────── */}
          <FadeUp delay={0.3}>
            <SectionHeader title={t('detailsTitle')} />
            {familyView ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gold/20 bg-surface p-4 shadow-card">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <Field label={t('fieldFather')}>{familyView.section.fatherName ?? '—'}{familyView.section.fatherOccupation ? ` · ${familyView.section.fatherOccupation}` : ''}</Field>
                    <Field label={t('fieldMother')}>{familyView.section.motherName ?? '—'}{familyView.section.motherOccupation ? ` · ${familyView.section.motherOccupation}` : ''}</Field>
                    <Field label={t('fieldFamilyType')}>{familyView.section.familyType ?? '—'}</Field>
                    <Field label={t('fieldFamilyValues')}>{familyView.section.familyValues ?? '—'}</Field>
                    <Field label={t('fieldNativePlace')}>{familyView.section.nativePlace ?? '—'}</Field>
                    <Field label={t('fieldFamilyStatus')}>{familyView.section.familyStatus ?? '—'}</Field>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t('editHintPre')} <Link href="/profile/family" className="text-teal underline">{t('editHintLink')}</Link>.
                  </p>
                  <RequestFamilyVerification verified={verification?.isVerified ?? false} />
                </div>
                <FamilyMembersClient initial={familyView.members} />
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title={t('detailsEmptyTitle')}
                description={t('detailsEmptyDesc')}
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
