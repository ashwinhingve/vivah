import { Image as ImageIcon } from 'lucide-react';
import { fetchMoodboard } from '@/lib/wedding-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { MoodBoardClient } from '@/components/wedding/MoodBoardClient.client';
import { addMoodBoardItemAction, deleteMoodBoardItemAction } from './actions';

interface PageProps { params: Promise<{ id: string }> }

export default async function MoodBoardPage({ params }: PageProps) {
  const { id } = await params;
  const res = await fetchMoodboard(id);
  const items = res?.items ?? [];

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
          <PageHeader
            title="Mood Board"
            description="Collect inspiration for your wedding theme, colors, and décor."
          />
          <MoodBoardClient
            weddingId={id}
            initialItems={items}
            addAction={addMoodBoardItemAction}
            deleteAction={deleteMoodBoardItemAction}
          />
        </div>
      </main>
    </PageTransition>
  );
}
