import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, Clock } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { getMyLinks } from '@/lib/family-mode-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { LinkRequestForm } from './LinkRequestForm.client';

export const metadata = { title: 'Link a family member' };
export const dynamic = 'force-dynamic';

const RELATIONSHIP_LABEL: Record<string, string> = {
  FATHER: 'Father', MOTHER: 'Mother', GUARDIAN: 'Guardian', SIBLING: 'Sibling',
};

export default async function NewFamilyLinkPage() {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'FAMILY_MEMBER' && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const cookieStore = await cookies();
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const links = await getMyLinks(cookieHeader);
  const pending = (links?.as_parent ?? []).filter(
    (l) => l.childConsentStatus === 'PENDING' && !l.revokedAt,
  );

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-8 pb-24">
        <FadeUp>
          <Link
            href="/family"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to family hub
          </Link>
          <PageHeader
            title="Link a family member"
            subtitle="Send a request to assist a family member with their matchmaking. They stay in full control — every request needs their approval, and they can revoke your access anytime."
          />
        </FadeUp>

        {pending.length > 0 && (
          <FadeUp>
            <div className="mb-6 rounded-xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-base text-primary">
                <Clock className="h-4 w-4 text-gold-muted" /> Awaiting their approval
              </h2>
              <ul className="space-y-2">
                {pending.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-primary">{l.childUserId}</span>
                    <span className="text-xs text-text-muted">
                      {RELATIONSHIP_LABEL[l.relationship] ?? l.relationship} · pending
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        )}

        <FadeUp>
          <LinkRequestForm />
        </FadeUp>
      </main>
    </PageTransition>
  );
}
