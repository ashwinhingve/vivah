import { fetchDayOfSnapshot } from '@/lib/wedding-api';
import { DayOfDashboard } from './DayOfDashboard.client';

export const metadata = { title: 'Day-of Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await fetchDayOfSnapshot(id);

  if (!snapshot) {
    return (
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="font-heading text-2xl text-foreground">Day-of dashboard unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The day-of snapshot could not be loaded. Check your access to this wedding.
        </p>
      </main>
    );
  }

  return <DayOfDashboard weddingId={id} initial={snapshot} />;
}
