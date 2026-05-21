import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import { getPendingActions } from '@/lib/family-mode-api';
import { ParentActionCard } from '@/components/family/ParentActionCard.client';

export default async function FamilyInboxPage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookieHeader = `better-auth.session_token=${cookieStore.get('better-auth.session_token')?.value ?? ''}`;
  const pending = (await getPendingActions(cookieHeader)) ?? [];

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-heading text-primary">Family inbox</h1>
        <p className="text-sm text-muted-foreground">
          Actions your parents or family have drafted on your behalf — your call.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-gold/20 bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">No pending family actions.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((a) => (
            <li key={a.id}><ParentActionCard action={a} /></li>
          ))}
        </ul>
      )}
    </main>
  );
}
