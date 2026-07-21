/**
 * Support console — status/priority badges via StatusChip (server-safe).
 */
import { cn } from '@/lib/utils';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import type { TicketPriority, TicketStatus } from '@/lib/support-api';
import { getLocale } from 'next-intl/server';

// Map ticket priority to StatusChip tone
const PRIORITY_TONE: Record<TicketPriority, StatusTone> = {
  LOW: 'teal',
  NORMAL: 'gold',
  HIGH: 'warning',
  URGENT: 'error',
};

// Map ticket status to StatusChip tone
const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  OPEN: 'teal',
  PENDING: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

function formatPriorityLabel(priority: TicketPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function formatStatusLabel(status: TicketStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
  return (
    <StatusChip tone={PRIORITY_TONE[priority]}>
      {formatPriorityLabel(priority)}
    </StatusChip>
  );
}

export function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <StatusChip tone={STATUS_TONE[status]}>
      {formatStatusLabel(status)}
    </StatusChip>
  );
}

export async function SlaBadge({ slaDueAt, overdue }: { slaDueAt: string | null; overdue: boolean }) {
  const locale = await getLocale();
  const localeTag = locale === 'hi' ? 'hi-IN' : 'en-IN';

  if (!slaDueAt) return <span className="text-xs text-text-muted">—</span>;

  const due = new Date(slaDueAt);
  const label = due.toLocaleDateString(localeTag, { day: 'numeric', month: 'short' }) +
    ' ' + due.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });

  // Overdue and Due labels are kept in English for admin staff UI clarity
  const prefix = overdue ? 'Overdue · ' : 'Due ';

  return (
    <span className={cn('text-xs', overdue ? 'font-semibold text-destructive' : 'text-text-muted')}>
      {prefix}{label}
    </span>
  );
}

/**
 * Chat-abuse reports carry a free-text `reason` (no fixed enum at capture
 * time — see apps/api/src/infrastructure/mongo/models/ChatReport.ts), so
 * severity is inferred with a keyword heuristic rather than trusted input.
 * Reuses the priority colour ramp so triage staff read report severity at a
 * glance, same as ticket priority.
 */
export function reportSeverity(reason: string): TicketPriority {
  const r = reason.toLowerCase();
  if (/threat|violen|assault|stalk|blackmail|extort|minor|child|self.?harm|suicide/.test(r)) return 'URGENT';
  if (/abuse|harass|fraud|scam|impersonat|explicit|nudity|sexual/.test(r)) return 'HIGH';
  if (/spam|solicit|advertis/.test(r)) return 'LOW';
  return 'NORMAL';
}

export function ReportSeverityPill({ reason }: { reason: string }) {
  return <PriorityPill priority={reportSeverity(reason)} />;
}
