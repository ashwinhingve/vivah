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
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {/* Back */}
        <Link
          href={`/weddings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#7B2D42] mb-6 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Overview
        </Link>

        <h1 className="font-heading text-2xl text-[#7B2D42] mb-1">Tasks</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Drag tasks through the pipeline or use the arrows to move them.
        </p>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6">
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
                  ? 'bg-[#0E7C7B]/10 text-[#0E7C7B]'
                  : 'text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Could not load tasks. Please try again.</p>
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
