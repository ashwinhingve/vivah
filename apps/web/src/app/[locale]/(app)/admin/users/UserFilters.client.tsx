'use client';
/**
 * UserFilters — search + role/status filter bar for the admin user directory.
 * Pushes a new URL with the chosen query params; the server component
 * re-fetches on nav. Mirrors admin/audit/AuditFilters.client.tsx.
 */
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { UserRole, UserStatus } from '@smartshaadi/types';

const ROLES: UserRole[] = ['INDIVIDUAL', 'FAMILY_MEMBER', 'VENDOR', 'EVENT_COORDINATOR', 'ADMIN', 'SUPPORT'];
const STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED'];

interface Props {
  initialQ: string;
  initialRole: string;
  initialStatus: string;
}

export function UserFilters({ initialQ, initialRole, initialStatus }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);

  function apply() {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    router.push(`/admin/users${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function clear() {
    setQ('');
    setRole('');
    setStatus('');
    router.push('/admin/users');
  }

  const hasFilters = Boolean(initialQ || initialRole || initialStatus);

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 shadow-card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Search</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
            placeholder="Name, email or phone"
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="block w-full min-h-[44px] rounded-lg border border-gold/30 bg-background px-3 text-sm focus:border-teal focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="flex h-10 items-center justify-center rounded-lg bg-teal px-4 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-teal-hover"
        >
          Apply filters
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="flex h-10 items-center justify-center rounded-lg border border-gold/30 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
