import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks } from '@/lib/family-mode-api';
import { LinkApprovalActions } from './LinkApprovalActions.client';

interface PageProps {
  params: Promise<{ linkId: string }>;
}

export default async function LinkRequestPage({ params }: PageProps) {
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
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
          You've already approved this {link.relationship.toLowerCase()}'s access.
        </p>
      </main>
    );
  }

  if (link.revokedAt) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          This link has been revoked.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">Family link request</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A {link.relationship.toLowerCase()} has requested access to your profile.
        </p>
      </header>

      <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6 space-y-2">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-gold-muted">Relationship</dt>
          <dd className="col-span-2 text-foreground">{link.relationship}</dd>
          <dt className="text-gold-muted">Permission</dt>
          <dd className="col-span-2 text-foreground">{link.permissions.replace(/_/g, ' ')}</dd>
          <dt className="text-gold-muted">Requested at</dt>
          <dd className="col-span-2 text-foreground">{new Date(link.createdAt).toLocaleString()}</dd>
        </dl>
        <p className="text-xs text-gold-muted pt-2">
          You retain final say on every action they draft. Approving only grants their tier of access —
          you can revoke anytime.
        </p>
      </section>

      <LinkApprovalActions linkId={link.id} />
    </main>
  );
}
