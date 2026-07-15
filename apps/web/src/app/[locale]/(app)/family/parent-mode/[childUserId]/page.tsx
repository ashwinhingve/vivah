import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { UserCog, Heart, ArrowLeft, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks, getDraftedActions, resolveNames } from '@/lib/family-mode-api';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';

interface PageProps {
  params: Promise<{ childUserId: string }>;
}

export default async function ManagedChildPage({ params }: PageProps) {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const t = await getTranslations('familyRole.parentMode');

  const { childUserId } = await params;
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const links = await getMyLinks(cookieHeader);
  const link = links?.as_parent.find(
    (l) => l.childUserId === childUserId && l.childConsentStatus === 'APPROVED' && !l.revokedAt,
  );
  if (!link) return await redirect('/family/parent-mode');

  const [drafted, resolved] = await Promise.all([
    getDraftedActions(cookieHeader),
    resolveNames({ userIds: [childUserId] }, cookieHeader),
  ]);
  const forThisChild = (drafted ?? []).filter((a) => a.childUserId === childUserId);
  const childName = resolved?.users.find((u) => u.userId === childUserId)?.name ?? t('childFallback');

  // Names referenced inside drafted-action payloads (target candidates), so
  // ParentActionCard never falls back to a raw UUID.
  const profileIds = Array.from(
    new Set(
      forThisChild
        .map((a) => (a.payload as { targetProfileId?: string }).targetProfileId)
        .filter((v): v is string => typeof v === 'string'),
    ),
  );
  const resolvedProfiles = profileIds.length ? await resolveNames({ profileIds }, cookieHeader) : null;
  const names: Record<string, string | null> = {};
  for (const p of resolvedProfiles?.profiles ?? []) names[p.profileId] = p.name;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <FadeUp>
          <Link
            href="/family/parent-mode"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {t('backLink')}
          </Link>
        </FadeUp>

        <RoleHero
          icon={UserCog}
          title={t('managing', { name: childName })}
          subtitle={t('childSubtitle', {
            tier: link.permissions.replace(/_/g, ' ').toLowerCase(),
            name: childName,
          })}
          rightSlot={
            <Link
              href={`/family/browse/${childUserId}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-teal px-4 text-sm font-medium text-white hover:bg-teal-hover"
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              {t('browseMatches')}
            </Link>
          }
        />

        <div className="mt-6">
          {forThisChild.length === 0 ? (
            <FadeUp>
              <div className="rounded-2xl border border-gold/20 bg-surface shadow-card">
                <EmptyState
                  variant="no-matches"
                  icon={Clock}
                  title={t('noActionsTitle')}
                  description={t('noActionsDesc', { name: childName })}
                  actionLabel={t('browseMatches')}
                  actionHref={`/family/browse/${childUserId}`}
                />
              </div>
            </FadeUp>
          ) : (
            <StaggerList className="space-y-3">
              {forThisChild.map((a) => (
                <ParentActionCard key={a.id} action={a} names={names} />
              ))}
            </StaggerList>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
