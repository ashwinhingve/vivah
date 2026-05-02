import { fetchIncidents } from '@/lib/wedding-api';
import { IncidentsClient } from './IncidentsClient.client';
import { EmptyState } from '@/components/shared/EmptyState';
import { AlertTriangle } from 'lucide-react';

export const metadata = { title: 'Incidents' };
export const dynamic = 'force-dynamic';

export default async function IncidentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchIncidents(id, { open: false });
  const incidents = data?.incidents ?? [];

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl text-foreground">Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Day-of issues raised by you or your coordinators.</p>
        </div>
      </header>

      <IncidentsClient weddingId={id} initial={incidents} />

      {incidents.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents reported"
          description="When you raise a day-of issue (vendor late, missing supplies, weather), it will appear here so coordinators can resolve it."
        />
      ) : null}
    </main>
  );
}
