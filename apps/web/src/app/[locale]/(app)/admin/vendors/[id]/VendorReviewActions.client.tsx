'use client';
/**
 * VendorReviewActions — sticky action panel on the admin vendor review page.
 * State-driven: shows the right buttons for PENDING / UNDER_REVIEW / APPROVED
 * / REJECTED / SUSPENDED. POSTs to the admin transition endpoints, then
 * router.refresh() to re-render the parent server component with new state.
 */
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Loader2, CheckCircle2, ShieldOff, PlayCircle, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type VendorStatus = 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
type RejectionCategory = 'INCOMPLETE_DOCS' | 'POLICY_VIOLATION' | 'IDENTITY_CONCERN' | 'OTHER';

interface Props {
  vendorId:         string;
  status:           VendorStatus;
  reviewedByUserId: string | null;
  currentAdminId:   string;
  rejectionReason:  string | null;
  rejectionCategory: string | null;
}

const CATEGORY_LABELS: Record<RejectionCategory, string> = {
  INCOMPLETE_DOCS:   'Incomplete documents',
  POLICY_VIOLATION:  'Policy violation',
  IDENTITY_CONCERN:  'Identity concern',
  OTHER:             'Other',
};

export function VendorReviewActions({
  vendorId,
  status,
  reviewedByUserId,
  currentAdminId,
  rejectionReason,
  rejectionCategory,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  async function callTransition(
    path: string,
    body?: Record<string, unknown>,
    successMsg = 'Updated',
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/vendors/${vendorId}/${path}`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        toast(successMsg, 'success');
        router.refresh();
        setShowRejectModal(false);
        setShowSuspendModal(false);
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        toast(j.error?.message ?? `Failed (HTTP ${res.status})`, 'error');
      }
    } catch {
      toast('Network error — try again', 'error');
    } finally {
      setBusy(false);
    }
  }

  const claimedByOther =
    status === 'UNDER_REVIEW' && reviewedByUserId !== null && reviewedByUserId !== currentAdminId;

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold text-primary">Review Actions</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Current status: <span className="font-semibold">{status}</span>
        </p>
      </div>

      {/* PENDING — claim */}
      {status === 'PENDING' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => callTransition('start-review', undefined, 'Claimed for review')}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover hover:shadow-md disabled:opacity-60 disabled:cursor-wait"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Start Review
        </button>
      )}

      {/* UNDER_REVIEW — claimed by me → approve / reject; claimed by other → disabled */}
      {status === 'UNDER_REVIEW' && !claimedByOther && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => callTransition('approve', undefined, 'Vendor approved')}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-success text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px disabled:opacity-60 disabled:cursor-wait"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowRejectModal(true)}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-destructive/40 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
      {status === 'UNDER_REVIEW' && claimedByOther && (
        <p className="rounded-lg border border-gold/20 bg-background px-3 py-2 text-xs text-muted-foreground">
          Claimed by another admin. Only the reviewer who started this can approve or reject.
        </p>
      )}

      {/* APPROVED — suspend */}
      {status === 'APPROVED' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowSuspendModal(true)}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-destructive/40 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
        >
          <ShieldOff className="h-4 w-4" /> Suspend
        </button>
      )}

      {/* REJECTED — show reason */}
      {status === 'REJECTED' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-semibold">Rejected — {rejectionCategory}</p>
          <p className="mt-1 text-xs">{rejectionReason ?? '—'}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Vendor must edit profile and re-submit before another review.
          </p>
        </div>
      )}

      {/* SUSPENDED — reinstate */}
      {status === 'SUSPENDED' && (
        <>
          {rejectionReason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-semibold">Suspension reason</p>
              <p className="mt-1">{rejectionReason}</p>
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => callTransition('reinstate', undefined, 'Vendor reinstated')}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white shadow-sm hover:-translate-y-px hover:bg-teal-hover transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reinstate
          </button>
        </>
      )}

      {/* DRAFT — nothing to do */}
      {status === 'DRAFT' && (
        <p className="rounded-lg border border-gold/20 bg-background px-3 py-2 text-xs text-muted-foreground">
          Vendor has not yet submitted for review.
        </p>
      )}

      {/* ── Reject modal ── */}
      {showRejectModal && (
        <RejectForm
          busy={busy}
          onCancel={() => setShowRejectModal(false)}
          onSubmit={(reason, category) => callTransition('reject', { reason, category }, 'Vendor rejected')}
        />
      )}

      {/* ── Suspend modal ── */}
      {showSuspendModal && (
        <SuspendForm
          busy={busy}
          onCancel={() => setShowSuspendModal(false)}
          onSubmit={(reason) => callTransition('suspend', { reason }, 'Vendor suspended')}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function RejectForm({
  busy, onCancel, onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, category: RejectionCategory) => void;
}) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<RejectionCategory>('INCOMPLETE_DOCS');
  const tooShort = reason.trim().length < 10;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.getElementById('reject-cat')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-card-hover">
        <h4 id="reject-title" className="font-heading text-lg font-semibold text-primary">Reject vendor</h4>
        <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="reject-cat">Category</label>
        <select
          id="reject-cat"
          value={category}
          onChange={(e) => setCategory(e.target.value as RejectionCategory)}
          className="mt-1 block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
        >
          {(Object.keys(CATEGORY_LABELS) as RejectionCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="reject-reason">Reason (50–500 chars recommended)</label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-sm focus:border-teal focus:outline-none"
          placeholder="Be specific so the vendor can fix and resubmit."
        />
        <p className={`mt-1 text-right text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
          {reason.length}/500 {tooShort && '· min 10'}
        </p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onCancel} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">Cancel</button>
          <button
            type="button"
            disabled={busy || tooShort}
            onClick={() => onSubmit(reason.trim(), category)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-white shadow-sm hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

function SuspendForm({
  busy, onCancel, onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const tooShort = reason.trim().length < 10;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.getElementById('suspend-reason')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="suspend-title">
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-surface p-5 shadow-card-hover">
        <h4 id="suspend-title" className="font-heading text-lg font-semibold text-primary">Suspend vendor</h4>
        <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="suspend-reason">Suspension reason</label>
        <textarea
          id="suspend-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-gold/30 bg-background px-3 py-2 text-sm focus:border-teal focus:outline-none"
          placeholder="What policy did the vendor violate?"
        />
        <p className={`mt-1 text-right text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
          {reason.length}/500 {tooShort && '· min 10'}
        </p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onCancel} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gold/30 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">Cancel</button>
          <button
            type="button"
            disabled={busy || tooShort}
            onClick={() => onSubmit(reason.trim())}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-semibold text-white shadow-sm hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Suspend
          </button>
        </div>
      </div>
    </div>
  );
}
