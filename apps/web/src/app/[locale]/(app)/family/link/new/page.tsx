import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, Clock } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { getMyLinks } from '@/lib/family-mode-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { LinkRequestForm } from './LinkRequestForm.client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('family.pages.linkNewPage');
  return { title: t('metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function NewFamilyLinkPage() {
  const t = await getTranslations('family.pages.linkNewPage');
  const tRel = await getTranslations('family.pages.linkRequestForm');
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
            <ArrowLeft className="h-4 w-4" /> {t('backToHub')}
          </Link>
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
          />
        </FadeUp>

        {pending.length > 0 && (
          <FadeUp>
            <div className="mb-6 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-base text-primary">
                <Clock className="h-4 w-4 text-gold-muted" /> {t('awaitingApproval')}
              </h2>
              <ul className="space-y-2">
                {pending.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-primary">{l.childUserId}</span>
                    <span className="text-xs text-text-muted">
                      {tRel(`relationship.${l.relationship}`)} · {t('pendingSuffix')}
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
