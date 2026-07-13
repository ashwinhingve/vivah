import { fetchDayOfSnapshot } from '@/lib/wedding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { DayOfDashboard } from './DayOfDashboard.client';

export const metadata = { title: 'Day-of Dashboard — Smart Shaadi' };
export const dynamic = 'force-dynamic';

export default async function DayOfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await fetchDayOfSnapshot(id);

  if (!snapshot) {
    return (
      <PageTransition>
        <main id="main-content" className="mx-auto max-w-3xl px-4 py-8">
          <PageHeader
            title="Day-of Dashboard"
            description="Real-time updates and ceremony coordination."
          />
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              The day-of snapshot could not be loaded. Check your access to this wedding.
            </p>
          </div>
        </main>
      </PageTransition>
    );
  }

  return <DayOfDashboard weddingId={id} initial={snapshot} />;
}
