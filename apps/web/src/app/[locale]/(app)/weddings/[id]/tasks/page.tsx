import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { TaskKanban } from '@/components/wedding/TaskKanban.client';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingTask } from '@smartshaadi/types';

interface TaskBoard {
  TODO:        WeddingTask[];
  IN_PROGRESS: WeddingTask[];
  DONE:        WeddingTask[];
}

async function fetchTasks(weddingId: string): Promise<WeddingTask[]> {
  const board = await fetchAuth<TaskBoard>(`/api/v1/weddings/${weddingId}/tasks`);
  if (board === null) return [];
  return [
    ...(board.TODO        ?? []),
    ...(board.IN_PROGRESS ?? []),
    ...(board.DONE        ?? []),
  ];
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'weddings.tasks.metadata' });
  return { title: t('title') };
}

export default async function TasksPage({ params, searchParams }: PageProps) {
  const t = await getTranslations('weddings.tasks');
  const { id } = await params;
  const { from } = (await searchParams) ?? {};
  const tasks = await fetchTasks(id);

  const back =
    from === 'budget'
      ? { href: `/weddings/${id}/budget`, label: 'Budget' }
      : { href: `/weddings/${id}`, label: 'Overview' };

  return (
    <PageTransition>
      <main id="main-content" className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {back.label}
          </Link>

          <PageHeader
            title={t('heading')}
            subtitle="Drag tasks through the pipeline or use the arrows to move them."
          />

          <TaskKanban weddingId={id} initialTasks={tasks} />
        </div>
      </main>
    </PageTransition>
  );
}
