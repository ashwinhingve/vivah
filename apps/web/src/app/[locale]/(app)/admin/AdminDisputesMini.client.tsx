'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface BookingDispute {
  id: string;
  bookingId: string;
  raisedBy: string;
  /** 'customer' | 'vendor' */
  raisedByType: string;
  reason: string;
  status: string;
  amount: number | null;
  raisedAt: string;
}

interface Props {
  /** Top-5 disputes pre-fetched server-side, passed as prop. */
  disputes: BookingDispute[];
}

function fmt(d: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(d));
}

function severityClass(d: BookingDispute): string {
  if (d.amount && d.amount >= 50000) return 'bg-destructive/10 text-destructive';
  if (d.amount && d.amount >= 10000) return 'bg-warning/10 text-warning';
  return 'bg-muted/40 text-text-muted';
}

function severityLabel(d: BookingDispute): string {
  if (d.amount && d.amount >= 50000) return 'High';
  if (d.amount && d.amount >= 10000) return 'Med';
  return 'Low';
}

export function AdminDisputesMini({ disputes }: Props) {
  if (disputes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle className="h-8 w-8 text-success" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-success">No open disputes</p>
        <p className="text-xs text-text-muted">All clear — no active escrow disputes</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gold/10">
      {disputes.map((d) => (
        <div key={d.id} className="flex items-start gap-3 px-4 py-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-text-muted">
                #{d.id.slice(0, 8)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${severityClass(d)}`}
              >
                {severityLabel(d)}
              </span>
              <span className="text-[11px] text-text-muted capitalize">
                by {d.raisedByType}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-text-primary">
              {d.reason ?? 'Dispute raised'}
            </p>
            <div className="mt-0.5 flex items-center gap-3 text-[10px] text-text-muted">
              {d.amount != null && (
                <span>
                  ₹{d.amount.toLocaleString('en-IN')}
                </span>
              )}
              <span>{fmt(d.raisedAt)}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="px-4 py-3">
        <Link
          href="/admin/escrow"
          className="text-xs font-semibold text-teal transition-colors hover:text-teal-hover"
        >
          View all disputes →
        </Link>
      </div>
    </div>
  );
}
