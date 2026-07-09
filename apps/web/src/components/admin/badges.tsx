/**
 * Admin console — presentational role/status pills (server-safe).
 * Mirrors apps/web/src/components/support/badges.tsx.
 */
import { cn } from '@/lib/utils';
import type { UserRole, UserStatus } from '@smartshaadi/types';

const ROLE_STYLES: Record<UserRole, string> = {
  INDIVIDUAL: 'bg-teal/10 text-teal border-teal/20',
  FAMILY_MEMBER: 'bg-gold/10 text-gold-muted border-gold/30',
  VENDOR: 'bg-primary/10 text-primary border-primary/20',
  EVENT_COORDINATOR: 'bg-success/10 text-success border-success/30',
  ADMIN: 'bg-destructive/10 text-destructive border-destructive/30',
  SUPPORT: 'bg-warning/10 text-warning border-warning/30',
};

const ROLE_LABELS: Record<UserRole, string> = {
  INDIVIDUAL: 'Individual',
  FAMILY_MEMBER: 'Family Member',
  VENDOR: 'Vendor',
  EVENT_COORDINATOR: 'Coordinator',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
};

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-success/10 text-success border-success/30',
  SUSPENDED: 'bg-destructive/10 text-destructive border-destructive/30',
  PENDING_VERIFICATION: 'bg-warning/10 text-warning border-warning/30',
  DELETED: 'bg-surface-muted text-muted-foreground border-border',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  PENDING_VERIFICATION: 'Pending',
  DELETED: 'Deleted',
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

export function RolePill({ role }: { role: UserRole }) {
  return pill(ROLE_LABELS[role], ROLE_STYLES[role]);
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  return pill(STATUS_LABELS[status], STATUS_STYLES[status]);
}
