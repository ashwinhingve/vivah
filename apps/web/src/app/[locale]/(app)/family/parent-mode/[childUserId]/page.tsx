import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks, getDraftedActions } from '@/lib/family-mode-api';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';

interface PageProps {
  params: Promise<{ childUserId: string }>;
}

export default async function ManagedChildPage({ params }: PageProps) {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const { childUserId } = await params;
  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;

  const links = await getMyLinks(cookieHeader);
  const link = links?.as_parent.find(
    (l) => l.childUserId === childUserId && l.childConsentStatus === 'APPROVED' && !l.revokedAt,
  );
  if (!link) return await redirect('/family/parent-mode');

  const drafted = (await getDraftedActions(cookieHeader)) ?? [];
  const forThisChild = drafted.filter((a) => a.childUserId === childUserId);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">
          Managing {link.relationship.toLowerCase()}
        </h1>
        <p className="text-sm text-muted-foreground">
          Permission tier: <strong>{link.permissions.replace(/_/g, ' ').toLowerCase()}</strong>
        </p>
      </header>

      <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6">
        <h2 className="text-base font-heading text-primary mb-3">Your drafted actions</h2>
        {forThisChild.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions drafted yet. Use the candidate detail page to send an interest on behalf of your family.
          </p>
        ) : (
          <ul className="space-y-3">
            {forThisChild.map((a) => (
              <li key={a.id}><ParentActionCard action={a} /></li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
