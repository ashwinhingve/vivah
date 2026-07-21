import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks } from '@/lib/family-mode-api';
import { LinkApprovalActions } from './LinkApprovalActions.client';

interface PageProps {
  params: Promise<{ linkId: string }>;
}

export default async function LinkRequestPage({ params }: PageProps) {
  const t = await getTranslations('family.pages.linkRequestPage');
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const { linkId } = await params;
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const links = await getMyLinks(cookieHeader);
  const link = links?.as_child.find((l) => l.id === linkId);
  if (!link) return await redirect('/family/parent-mode');

  if (link.childConsentStatus === 'APPROVED') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
          {t('alreadyApproved', { relationship: link.relationship.toLowerCase() })}
        </p>
      </main>
    );
  }

  if (link.revokedAt) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {t('linkRevoked')}
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle', { relationship: link.relationship.toLowerCase() })}
        </p>
      </header>

      <section className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6 space-y-2">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-gold-muted">{t('relationshipLabel')}</dt>
          <dd className="col-span-2 text-foreground">{link.relationship}</dd>
          <dt className="text-gold-muted">{t('permissionLabel')}</dt>
          <dd className="col-span-2 text-foreground">{link.permissions.replace(/_/g, ' ')}</dd>
          <dt className="text-gold-muted">{t('requestedAtLabel')}</dt>
          <dd className="col-span-2 text-foreground">{new Date(link.createdAt).toLocaleString()}</dd>
        </dl>
        <p className="text-xs text-gold-muted pt-2">
          {t('note')}
        </p>
      </section>

      <LinkApprovalActions linkId={link.id} />
    </main>
  );
}
