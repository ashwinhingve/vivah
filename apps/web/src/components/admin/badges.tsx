/**
 * Admin console — presentational role/status pills (server-safe).
 * Mirrors apps/web/src/components/support/badges.tsx.
 */
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import type { UserRole, UserStatus } from '@smartshaadi/types';

const ROLE_TONES: Record<UserRole, StatusTone> = {
  INDIVIDUAL: 'teal',
  FAMILY_MEMBER: 'gold',
  VENDOR: 'primary',
  EVENT_COORDINATOR: 'success',
  ADMIN: 'error',
  SUPPORT: 'warning',
};

const ROLE_LABELS: Record<UserRole, string> = {
  INDIVIDUAL: 'Individual',
  FAMILY_MEMBER: 'Family Member',
  VENDOR: 'Vendor',
  EVENT_COORDINATOR: 'Coordinator',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
};

const STATUS_TONES: Record<UserStatus, StatusTone> = {
  ACTIVE: 'success',
  SUSPENDED: 'error',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'neutral',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  PENDING_VERIFICATION: 'Pending',
  DELETED: 'Deleted',
};

export function RolePill({ role }: { role: UserRole }) {
  return <StatusChip tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</StatusChip>;
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  return <StatusChip tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</StatusChip>;
}
