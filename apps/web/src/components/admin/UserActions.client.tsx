'use client';
/**
 * UserActions — admin account status control (suspend / reactivate).
 * State-driven confirm modal with a reason textarea, mirrors the
 * VendorReviewActions reject/suspend pattern. Calls the setUserStatusAction
 * Server Action, then router.refresh() to re-render the parent server
 * component with the new status.
 */
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Loader2, ShieldOff, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { setUserStatusAction } from '@/app/[locale]/(app)/admin/users/actions';
import type { UserStatus } from '@smartshaadi/types';

interface Props {
  userId: string;
  status: UserStatus;
}

export function UserActions({ userId, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const isSuspended = status === 'SUSPENDED';
  const isDeleted = status === 'DELETED';

  async function submit() {
    if (busy) return;
    const nextStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';
    if (!isSuspended && reason.trim().length < 10) {
      setFormError('Reason must be at least 10 characters.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const result = await setUserStatusAction(userId, nextStatus, reason.trim() || undefined);
    setBusy(false);
    if (result.ok) {
      toast(nextStatus === 'SUSPENDED' ? 'User suspended' : 'User reactivated', 'success');
      setShowModal(false);
      setReason('');
      router.refresh();
    } else {
      setFormError(result.error);
      toast(result.error, 'error');
    }
  }

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', onKey);
    document.getElementById('user-action-reason')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [showModal]);

  if (isDeleted) {
    return (
      <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
        <h3 className="font-heading text-base font-semibold text-primary">Account Actions</h3>
        <p className="mt-2 rounded-lg border border-gold/20 bg-background px-3 py-2 text-xs text-muted-foreground">
          Account deleted — no actions available.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold text-primary">Account Actions</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Current status: <span className="font-semibold">{status}</span>
        </p>
      </div>

      {isSuspended ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowModal(true)}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md disabled:opacity-60 disabled:cursor-wait"
        >
          <RotateCcw className="h-4 w-4" />
          Reactivate
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowModal(true)}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-destructive/40 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
        >
          <ShieldOff className="h-4 w-4" /> Suspend
        </button>
      )}

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-action-title"
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-card-hover">
            <h4 id="user-action-title" className="font-heading text-lg font-semibold text-primary">
              {isSuspended ? 'Reactivate user' : 'Suspend user'}
            </h4>
            <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="user-action-reason">
              Reason {isSuspended ? '(optional)' : '(min 10 characters)'}
            </label>
            <textarea
              id="user-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-sm focus:border-teal focus:outline-none"
              placeholder={isSuspended ? 'Optional note for the audit log.' : 'Why is this account being suspended?'}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{reason.length}/500</p>
            {formError ? <p className="mt-1 text-xs text-destructive">{formError}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  isSuspended ? 'bg-teal hover:bg-teal-hover' : 'bg-destructive'
                }`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSuspended ? 'Confirm Reactivate' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
