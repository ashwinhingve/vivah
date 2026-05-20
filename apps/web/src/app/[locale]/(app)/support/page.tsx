import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { EmptyState } from '@/components/shared/EmptyState';

export const metadata = { title: 'Support Console' };
export const dynamic = 'force-dynamic';

export default async function SupportConsolePage() {
  // Role guard — middleware does the same check; page guard belt-and-braces.
  const me = await fetchAuth<{ id: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'SUPPORT' && me.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl text-primary">Support console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resolve customer complaints, escalations, and account issues.
        </p>
      </header>

      <EmptyState
        icon={LifeBuoy}
        title="Complaint queue coming soon"
        description="The ticket triage console is in build. For now, escalations land in the admin audit log; check with engineering for direct DB access."
      />
    </main>
  );
}
