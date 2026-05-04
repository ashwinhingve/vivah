'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  addQuestionAction, updateQuestionAction, deleteQuestionAction,
} from '@/app/(app)/weddings/[id]/rsvp-questions/actions';
import type { RsvpCustomQuestion, RsvpQuestionType } from '@smartshaadi/types';

interface Props { weddingId: string; initial: RsvpCustomQuestion[]; }

const TYPES: RsvpQuestionType[] = ['TEXT', 'BOOLEAN', 'CHOICE'];

export function RsvpQuestionsBuilder({ weddingId, initial }: Props) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<RsvpCustomQuestion[]>(initial);
  const [adding, startAdding] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleting] = useTransition();
  const [text, setText] = useState('');
  const [type, setType] = useState<RsvpQuestionType>('TEXT');
  const [choices, setChoices] = useState('');
  const [required, setRequired] = useState(false);

  function handleAdd(e: React.FormEvent): void {
    e.preventDefault();
    if (!text.trim()) { toast('Enter a question', 'error'); return; }
    const payload: Record<string, unknown> = {
      questionText: text.trim(),
      questionType: type,
      isRequired:   required,
    };
    if (type === 'CHOICE') {
      const items = choices.split('|').map(s => s.trim()).filter(Boolean);
      if (items.length < 2) { toast('Choice questions need at least 2 options (separate with |)', 'error'); return; }
      payload['choices'] = items;
    }
    startAdding(async () => {
      const r = await addQuestionAction(weddingId, payload);
      if (r.ok && r.data) {
        setQuestions(prev => [...prev, r.data!]);
        setText(''); setChoices(''); setRequired(false); setType('TEXT');
        toast('Question added', 'success');
      } else {
        toast(r.error ?? 'Failed', 'error');
      }
    });
  }

  function confirmDelete(): void {
    if (!deletingId) return;
    const id = deletingId;
    startDeleting(async () => {
      const r = await deleteQuestionAction(weddingId, id);
      if (r.ok) {
        setQuestions(prev => prev.filter(q => q.id !== id));
        toast('Question deleted', 'success');
      } else {
        toast(r.error ?? 'Failed', 'error');
      }
      setDeletingId(null);
    });
  }

  async function toggleRequired(q: RsvpCustomQuestion): Promise<void> {
    const r = await updateQuestionAction(weddingId, q.id, { isRequired: !q.isRequired });
    if (r.ok && r.data) {
      setQuestions(prev => prev.map(x => x.id === q.id ? r.data! : x));
    } else {
      toast(r.error ?? 'Failed', 'error');
    }
  }

  return (
    <div>
      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4 mb-6">
        <h3 className="font-medium text-sm text-primary mb-3">Add a question</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Question text"
            className="sm:col-span-2 min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2 text-sm outline-none focus:border-teal"
            required
          />
          <select value={type} onChange={(e) => setType(e.target.value as RsvpQuestionType)} className="min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2 text-sm">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {type === 'CHOICE' && (
          <input
            value={choices}
            onChange={(e) => setChoices(e.target.value)}
            placeholder="Options separated by | (e.g. Beer|Wine|None)"
            className="w-full mt-3 min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2 text-sm"
          />
        )}
        <label className="flex items-center gap-2 text-sm mt-3">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={adding} className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5 bg-teal">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add question
          </button>
        </div>
      </form>

      {/* List */}
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No custom questions yet.</p>
      ) : (
        <ul className="space-y-2">
          {questions.map(q => (
            <li key={q.id} className="bg-surface border border-gold/20 rounded-xl shadow-sm p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{q.questionText}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {q.questionType}{q.isRequired ? ' · required' : ''}{q.choices ? ` · ${q.choices.length} options` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleRequired(q)} className="text-xs text-muted-foreground hover:text-primary underline">
                    {q.isRequired ? 'Make optional' : 'Make required'}
                  </button>
                  <button onClick={() => setDeletingId(q.id)} className="text-destructive hover:bg-destructive/10 rounded p-1" aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete question?"
        description="Existing answers will be preserved on guest records, but this question will no longer be asked."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
