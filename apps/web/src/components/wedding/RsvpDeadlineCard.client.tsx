'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { upsertDeadlineAction } from '@/app/(app)/weddings/[id]/guests/actions';
import type { RsvpDeadline } from '@smartshaadi/types';

interface Props { weddingId: string; initial: RsvpDeadline | null; }

export function RsvpDeadlineCard({ weddingId, initial }: Props) {
  const { toast } = useToast();
  const [deadline, setDeadline]   = useState(initial?.deadline ? initial.deadline.slice(0, 16) : '');
  const [enforced, setEnforced]   = useState(initial?.enforced ?? false);
  const [reminderDays, setRDays]  = useState((initial?.reminderDays ?? [7, 3, 1]).join(','));
  const [isSaving, startSaving]   = useTransition();

  function handleSave(): void {
    if (!deadline) { toast('Pick a deadline date', 'error'); return; }
    const days = reminderDays.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0 && n <= 120);
    startSaving(async () => {
      const r = await upsertDeadlineAction(weddingId, {
        deadline: new Date(deadline).toISOString(),
        enforced,
        reminderDays: days,
      });
      if (r.ok) toast('Deadline saved', 'success');
      else toast(r.error ?? 'Failed to save', 'error');
    });
  }

  const daysRemaining = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;

  return (
    <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 mb-6">
      <h3 className="font-medium text-sm text-[#7B2D42] mb-3">RSVP Deadline</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Deadline</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reminder days (comma-separated)</label>
          <input
            value={reminderDays}
            onChange={(e) => setRDays(e.target.value)}
            placeholder="7,3,1"
            className="w-full min-h-[44px] rounded-lg border border-[#C5A47E]/40 bg-[#FEFAF6] px-3 py-2 text-sm outline-none focus:border-[#0E7C7B]"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)} className="h-4 w-4" />
            Reject submissions after deadline
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-muted-foreground">
          {daysRemaining != null ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining` : 'Deadline not set'}
        </p>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-[44px] px-4 rounded-lg text-white text-sm font-medium disabled:opacity-60 flex items-center gap-1.5"
          style={{ backgroundColor: '#0E7C7B' }}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save deadline
        </button>
      </div>
    </div>
  );
}
