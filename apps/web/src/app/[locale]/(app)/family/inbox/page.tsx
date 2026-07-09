import { cookies } from 'next/headers';
import { Inbox } from 'lucide-react';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { fetchAuth } from '@/lib/server-fetch';
import { getPendingActions, resolveNames } from '@/lib/family-mode-api';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { StaggerList } from '@/components/shared/StaggerList.client';
import { RoleHero } from '@/components/shared/RoleHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';
import { FamilyInviteCode } from '@/components/family/FamilyInviteCode.client';

export const metadata = { title: 'Family requests' };
export const dynamic = 'force-dynamic';

export default async function FamilyInboxPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const [pendingRes, me] = await Promise.all([
    getPendingActions(cookieHeader),
    fetchAuth<{ userId: string; role: string }>('/api/auth/me'),
  ]);
  const pending = pendingRes ?? [];

  // Resolve the candidate profile ids referenced by drafted actions → names,
  // so the child never approves an action against a raw UUID.
  const profileIds = Array.from(
    new Set(
      pending
        .map((a) => (a.payload as { targetProfileId?: string }).targetProfileId)
        .filter((v): v is string => typeof v === 'string'),
    ),
  );
  const resolved = profileIds.length ? await resolveNames({ profileIds }, cookieHeader) : null;
  const names: Record<string, string | null> = {};
  for (const p of resolved?.profiles ?? []) names[p.profileId] = p.name;

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <RoleHero
          icon={Inbox}
          title="Family requests"
          subtitle="Actions your family drafted on your behalf. Nothing happens until you approve — your call."
        />

        {me?.userId && (
          <div className="mt-6">
            <FadeUp>
              <FamilyInviteCode code={me.userId} />
            </FadeUp>
          </div>
        )}

        <div className="mt-6">
          {pending.length === 0 ? (
            <FadeUp>
              <div className="rounded-xl border border-gold/20 bg-surface shadow-card">
                <EmptyState
                  variant="no-notifications"
                  title="Nothing to review"
                  description="When a family member drafts an interest or message for you, it’ll appear here to approve or decline."
                />
              </div>
            </FadeUp>
          ) : (
            <StaggerList className="space-y-3">
              {pending.map((a) => (
                <ParentActionCard key={a.id} action={a} names={names} />
              ))}
            </StaggerList>
          )}
        </div>
      </main>
    </PageTransition>
  );
}
