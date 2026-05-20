import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getMyLinks } from '@/lib/family-mode-api';

export default async function ParentModeDashboardPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) redirect('/login');

  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const links = await getMyLinks(cookieHeader);

  const asParent = links?.as_parent ?? [];
  const asChild  = links?.as_child  ?? [];

  const approvedAsParent = asParent.filter(
    (l) => l.childConsentStatus === 'APPROVED' && !l.revokedAt,
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">Parent Mode</h1>
        <p className="text-sm text-muted-foreground">
          Manage profiles on behalf of family members — with their consent.
        </p>
      </header>

      <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6">
        <h2 className="text-base font-heading text-primary mb-3">Children you manage</h2>
        {approvedAsParent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don't manage any profiles yet. Send a request from the child's settings page.
          </p>
        ) : (
          <ul className="space-y-2">
            {approvedAsParent.map((l) => (
              <li key={l.id} className="flex items-center justify-between border border-gold/15 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">User: {l.childUserId}</p>
                  <p className="text-xs text-gold-muted">
                    {l.relationship} · {l.permissions}
                  </p>
                </div>
                <Link
                  href={`/family/parent-mode/${l.childUserId}`}
                  className="text-sm text-teal hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {asChild.length > 0 && (
        <section className="rounded-xl border border-gold/20 bg-surface p-4 sm:p-6">
          <h2 className="text-base font-heading text-primary mb-3">Your family managers</h2>
          <ul className="space-y-2">
            {asChild.map((l) => (
              <li key={l.id} className="flex items-center justify-between border border-gold/15 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{l.relationship}</p>
                  <p className="text-xs text-gold-muted">
                    {l.permissions} · {l.childConsentStatus}
                  </p>
                </div>
                {l.childConsentStatus === 'PENDING' && (
                  <Link
                    href={`/family/link-request/${l.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Review →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
