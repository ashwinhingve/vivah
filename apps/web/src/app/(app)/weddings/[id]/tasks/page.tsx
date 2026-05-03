import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TaskKanban } from '@/components/wedding/TaskKanban.client';
import { fetchAuth } from '@/lib/server-fetch';
import type { WeddingTask } from '@smartshaadi/types';

interface TaskBoard {
  TODO:        WeddingTask[];
  IN_PROGRESS: WeddingTask[];
  DONE:        WeddingTask[];
}

async function fetchTasks(weddingId: string): Promise<{ tasks: WeddingTask[]; error: boolean; notFound: boolean }> {
  const board = await fetchAuth<TaskBoard>(`/api/v1/weddings/${weddingId}/tasks`);
  if (board === null) return { tasks: [], error: true, notFound: false };
  const tasks = [
    ...(board.TODO        ?? []),
    ...(board.IN_PROGRESS ?? []),
    ...(board.DONE        ?? []),
  ];
  return { tasks, error: false, notFound: false };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TasksPage({ params }: PageProps) {
  const { id } = await params;
  const { tasks, error, notFound: nf } = await fetchTasks(id);

  if (nf) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-primary mb-1">Tasks</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Drag tasks through the pipeline or use the arrows to move them.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-surface border border-gold/20 rounded-xl shadow-sm p-1 mb-6">
          {[
            { href: `/weddings/${id}/tasks`,  label: 'Tasks',  active: true },
            { href: `/weddings/${id}/budget`, label: 'Budget', active: false },
            { href: `/weddings/${id}/guests`, label: 'Guests', active: false },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 text-center min-h-[44px] py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-teal/10 text-teal'
                  : 'text-muted-foreground hover:text-primary hover:bg-background'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
            <p className="text-destructive font-medium">Could not load tasks. Please try again.</p>
          </div>
        )}

        {/* Kanban */}
        {!error && (
          <TaskKanban weddingId={id} initialTasks={tasks} />
        )}
      </div>
    </div>
  );
}
