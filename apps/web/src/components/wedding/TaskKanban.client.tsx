'use client';

import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeddingTask, TaskStatus, TaskPriority } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO',        label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE',        label: 'Done' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW:    'text-green-700 bg-green-50',
  MEDIUM: 'text-amber-700 bg-amber-50',
  HIGH:   'text-red-700 bg-red-50',
};

const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

interface TaskKanbanProps {
  weddingId: string;
  initialTasks: WeddingTask[];
}

interface MoveResponse {
  success: boolean;
  data?: WeddingTask;
  error?: string;
}

interface CreateResponse {
  success: boolean;
  data?: WeddingTask;
  error?: string;
}

export function TaskKanban({ weddingId, initialTasks }: TaskKanbanProps) {
  const [tasks, setTasks] = useState<WeddingTask[]>(initialTasks);
  const [isPending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  // New task form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();

  function moveStatus(task: WeddingTask, direction: 'prev' | 'next') {
    const currentIdx = STATUS_ORDER.indexOf(task.status);
    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= STATUS_ORDER.length) return;
    const newStatus = STATUS_ORDER[nextIdx];

    setMovingId(task.id);
    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/weddings/${weddingId}/tasks/${task.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: newStatus }),
          credentials: 'include',
        });
        const json = (await res.json()) as MoveResponse;
        if (json.success && json.data) {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? json.data! : t)));
        }
      } finally {
        setMovingId(null);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreateError(null);

    startCreating(async () => {
      try {
        const body: Record<string, unknown> = {
          title:    newTitle.trim(),
          priority: newPriority,
          status:   'TODO' as TaskStatus,
        };
        if (newDueDate) body['dueDate'] = newDueDate;

        const res = await fetch(`${API_URL}/api/v1/weddings/${weddingId}/tasks`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
          credentials: 'include',
        });
        const json = (await res.json()) as CreateResponse;
        if (json.success && json.data) {
          setTasks((prev) => [json.data!, ...prev]);
          setNewTitle('');
          setNewDueDate('');
          setNewPriority('MEDIUM');
          setShowForm(false);
        } else {
          setCreateError(json.error ?? 'Could not create task.');
        }
      } catch {
        setCreateError('Network error. Please try again.');
      }
    });
  }

  return (
    <div>
      {/* Add task button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: '#0E7C7B' }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Task
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-4"
        >
          {createError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Task title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="flex-1 min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B] focus:ring-1 focus:ring-[#0E7C7B]"
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B]"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5"
              style={{ backgroundColor: '#0E7C7B' }}
            >
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COLUMNS.map(({ status, label }, colIdx) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center justify-between px-1 mb-1">
                <h3 className="font-medium text-sm text-foreground">{label}</h3>
                <span className="text-xs text-muted-foreground bg-[#F5EFE8] rounded-full px-2 py-0.5">
                  {colTasks.length}
                </span>
              </div>

              {/* Column body */}
              <div className="flex flex-col gap-2 min-h-[80px]">
                {colTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#C5A47E]/30 p-4 text-center text-xs text-muted-foreground">
                    No tasks here
                  </div>
                )}
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-3 transition-opacity',
                      movingId === task.id && isPending ? 'opacity-40' : 'opacity-100'
                    )}
                  >
                    <p className="text-sm font-medium text-foreground leading-snug mb-2">
                      {task.title}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          PRIORITY_COLORS[task.priority]
                        )}
                      >
                        <Flag className="h-2.5 w-2.5" aria-hidden="true" />
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-[#F5EFE8] px-1.5 py-0.5 rounded-full">
                          <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
                          {new Date(task.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>

                    {/* Move arrows */}
                    <div className="flex gap-1 mt-1">
                      {colIdx > 0 && (
                        <button
                          onClick={() => moveStatus(task, 'prev')}
                          disabled={isPending}
                          aria-label={`Move "${task.title}" to ${COLUMNS[colIdx - 1]?.label}`}
                          className="flex items-center gap-0.5 min-h-[32px] px-2 rounded-lg text-xs text-muted-foreground hover:text-[#7B2D42] hover:bg-[#FEFAF6] disabled:opacity-40 transition-colors border border-transparent hover:border-[#C5A47E]/30"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          {COLUMNS[colIdx - 1]?.label}
                        </button>
                      )}
                      {colIdx < COLUMNS.length - 1 && (
                        <button
                          onClick={() => moveStatus(task, 'next')}
                          disabled={isPending}
                          aria-label={`Move "${task.title}" to ${COLUMNS[colIdx + 1]?.label}`}
                          className="flex items-center gap-0.5 min-h-[32px] px-2 rounded-lg text-xs text-[#0E7C7B] hover:bg-[#0E7C7B]/10 disabled:opacity-40 transition-colors border border-transparent hover:border-[#0E7C7B]/30 ml-auto"
                        >
                          {COLUMNS[colIdx + 1]?.label}
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
