import { fetchIncidents } from '@/lib/wedding-api';
import { IncidentsClient } from './IncidentsClient.client';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { AlertTriangle } from 'lucide-react';

export const metadata = { title: 'Incidents — Smart Shaadi' };
export const dynamic = 'force-dynamic';

export default async function IncidentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchIncidents(id, { open: false });
  const incidents = data?.incidents ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
        <PageHeader
          title="Incidents"
          description="Day-of issues raised by you or your coordinators."
        />

        <IncidentsClient weddingId={id} initial={incidents} />

        {incidents.length === 0 ? (
          <EmptyState
            variant="no-tasks"
            title="No incidents reported"
            description="When you raise a day-of issue (vendor late, missing supplies, weather), it will appear here so coordinators can resolve it."
          />
        ) : null}
      </main>
    </PageTransition>
  );
}
