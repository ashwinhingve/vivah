/**
 * Support console — presentational status/priority/SLA badges (server-safe).
 */
import { cn } from '@/lib/utils';
import type { TicketPriority, TicketStatus } from '@/lib/support-api';

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-teal/10 text-teal border-teal/20',
  NORMAL: 'bg-gold/10 text-gold-muted border-gold/30',
  HIGH: 'bg-warning/10 text-warning border-warning/30',
  URGENT: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-teal/10 text-teal border-teal/20',
  PENDING: 'bg-warning/10 text-warning border-warning/30',
  RESOLVED: 'bg-success/10 text-success border-success/30',
  CLOSED: 'bg-surface-muted text-text-muted border-border',
};

function pill(label: string, className: string) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
  return pill(priority.charAt(0) + priority.slice(1).toLowerCase(), PRIORITY_STYLES[priority]);
}

export function StatusPill({ status }: { status: TicketStatus }) {
  return pill(status.charAt(0) + status.slice(1).toLowerCase(), STATUS_STYLES[status]);
}

export function SlaBadge({ slaDueAt, overdue }: { slaDueAt: string | null; overdue: boolean }) {
  if (!slaDueAt) return <span className="text-xs text-text-muted">—</span>;
  const due = new Date(slaDueAt);
  const label = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' ' + due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return (
    <span className={cn('text-xs', overdue ? 'font-semibold text-destructive' : 'text-text-muted')}>
      {overdue ? 'Overdue · ' : 'Due '}{label}
    </span>
  );
}
