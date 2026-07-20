'use client';
/**
 * VendorStatusBanner — rendered at the top of /vendor-dashboard when the
 * vendor's approval status is anything other than APPROVED. Polls
 * /api/v1/vendors/me/status on mount; falls back to hidden if no row.
 * P1-8 (docs/PHASE-1-4-AUDIT.md).
 */
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { Info, AlertTriangle, Loader2 } from 'lucide-react';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type VendorStatus = 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface StatusView {
  status:            VendorStatus;
  submittedAt:       string | null;
  reviewedAt:        string | null;
  rejectionReason:   string | null;
  rejectionCategory: string | null;
}

export function VendorStatusBanner() {
  const [view, setView] = useState<StatusView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/vendors/me/status`, { credentials: 'include' });
        if (!cancelled && res.ok) {
          const json = (await res.json()) as { success: boolean; data: StatusView };
          if (json.success) setView(json.data);
        }
      } catch {
        /* silent — banner stays hidden */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;
  if (!view || view.status === 'APPROVED') return null;

  if (view.status === 'PENDING' || view.status === 'UNDER_REVIEW') {
    const statusTone: StatusTone = 'warning';
    const statusLabel = view.status === 'PENDING' ? 'Pending' : 'Under Review';
    return (
      <div className="mx-4 mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-teal/30 bg-teal/5 px-4 py-3 text-sm">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-teal" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-teal">
              {view.status === 'PENDING' ? 'Application submitted' : 'Our team is reviewing your profile'}
            </p>
            <StatusChip tone={statusTone} className="text-2xs font-semibold">
              {statusLabel}
            </StatusChip>
          </div>
          <p className="text-xs text-muted-foreground">
            Average review time: 2–3 business days. We&apos;ll notify you here as soon as a decision is made.
          </p>
        </div>
      </div>
    );
  }

  if (view.status === 'REJECTED') {
    return (
      <div className="mx-4 mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-destructive">
              Application needs attention
            </p>
            <StatusChip tone="error" className="text-2xs font-semibold">
              Rejected
            </StatusChip>
          </div>
          <p className="text-xs text-muted-foreground">
            {view.rejectionCategory ?? 'See reason below'}
          </p>
          <p className="mt-0.5 text-xs text-foreground">{view.rejectionReason ?? '—'}</p>
          <Link
            href="/vendor-dashboard?tab=profile"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            Update profile & re-submit
          </Link>
        </div>
      </div>
    );
  }

  if (view.status === 'SUSPENDED') {
    return (
      <div className="mx-4 mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-destructive">Your profile is currently suspended</p>
          <p className="mt-0.5 text-xs text-foreground">{view.rejectionReason ?? '—'}</p>
          <a
            href="mailto:support@smartshaadi.co.in?subject=Vendor%20suspension%20appeal"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  // DRAFT — prompt to submit
  return (
    <div className="mx-4 mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-primary">Your profile is in draft</p>
          <StatusChip tone="gold" className="text-2xs font-semibold">
            Draft
          </StatusChip>
        </div>
        <p className="text-xs text-muted-foreground">
          Complete your business details and submit for review to start receiving bookings.
        </p>
      </div>
    </div>
  );
}
