'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Pencil, MoreVertical, Loader2, X } from 'lucide-react';
import type { WeddingActionState } from './actions';

interface WeddingHeaderActionsProps {
  wedding: {
    weddingName: string | null;
    weddingDate: string | null;
    venueName: string | null;
    venueCity: string | null;
    venueAddress: string | null;
    budgetTotal: number | null;
  };
  /** updateWeddingAction bound to the wedding id → (prev, formData). */
  editAction: (
    prev: WeddingActionState,
    formData: FormData,
  ) => Promise<WeddingActionState>;
  /** cancelWeddingAction bound to the wedding id. */
  cancelAction: () => Promise<void>;
  /** deleteWeddingAction bound to the wedding id (redirects on success). */
  deleteAction: () => Promise<void>;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      Save Changes
    </button>
  );
}

export function WeddingHeaderActions({
  wedding,
  editAction,
  cancelAction,
  deleteAction,
}: WeddingHeaderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, formAction] = useActionState<WeddingActionState, FormData>(
    editAction,
    { status: 'idle' },
  );
  const today = new Date().toISOString().split('T')[0];

  // Close the sheet once the update succeeds.
  useEffect(() => {
    if (state.status === 'success') setEditOpen(false);
  }, [state.status]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        aria-label="Edit wedding details"
        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-gold/30 text-sm text-muted-foreground hover:text-primary hover:border-gold/50 transition-colors"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Edit Details
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-primary hover:bg-background transition-colors"
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              role="menu"
              className="absolute right-0 mt-1 z-20 w-48 rounded-lg border border-gold/30 bg-surface shadow-card-hover py-1"
            >
              <form action={cancelAction}>
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full text-left px-4 py-2.5 text-sm text-warning hover:bg-background transition-colors"
                >
                  Cancel Plan
                </button>
              </form>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-background transition-colors"
              >
                Delete Plan
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-gold/20 p-6 shadow-card">
            <h2 className="font-heading text-lg text-primary mb-1">Delete this plan?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This permanently removes the wedding plan from your list. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] px-4 rounded-lg border border-gold/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Keep Plan
              </button>
              <form action={deleteAction}>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-lg bg-destructive text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Delete Plan
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-gold/20 p-6 shadow-card max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-primary">Edit Wedding Details</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
                className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-background transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {state.status === 'error' && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {state.message}
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <Field label="Wedding Name">
                <input
                  name="weddingName"
                  type="text"
                  defaultValue={wedding.weddingName ?? ''}
                  placeholder="e.g. Priya & Rahul"
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>
              <Field label="Wedding Date">
                <input
                  name="weddingDate"
                  type="date"
                  min={today}
                  defaultValue={wedding.weddingDate ?? ''}
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>
              <Field label="Venue Name">
                <input
                  name="venueName"
                  type="text"
                  defaultValue={wedding.venueName ?? ''}
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>
              <Field label="City">
                <input
                  name="venueCity"
                  type="text"
                  defaultValue={wedding.venueCity ?? ''}
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>
              <Field label="Venue Address">
                <input
                  name="venueAddress"
                  type="text"
                  defaultValue={wedding.venueAddress ?? ''}
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>
              <Field label="Total Budget (₹)">
                <input
                  name="budgetTotal"
                  type="number"
                  min="0"
                  step="1000"
                  defaultValue={wedding.budgetTotal ?? ''}
                  className="w-full min-h-[44px] rounded-lg border border-gold/40 bg-background px-3 py-2.5 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="min-h-[44px] px-4 rounded-lg border border-gold/40 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <SaveButton />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
