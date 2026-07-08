'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Ban, CheckCircle2, Download, X } from 'lucide-react';
import type { UserRole, UserStatus } from '@smartshaadi/types';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { RolePill, UserStatusPill } from '@/components/admin/badges';
import { bulkSetUserStatusAction } from './actions';

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

function toCsv(rows: UserRow[]): string {
  const head = ['id', 'name', 'email', 'phone', 'role', 'status', 'createdAt'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.id, r.name, r.email, r.phone, r.role, r.status, r.createdAt].map(esc).join(','));
  return [head.join(','), ...lines].join('\n');
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleAll(allKeys: string[], allSelected: boolean) {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  }

  function applyBulk(status: 'SUSPENDED' | 'ACTIVE') {
    setMsg(null);
    startTransition(async () => {
      const r = await bulkSetUserStatusAction(Array.from(selected), status, reason.trim() || undefined);
      setMsg(
        r.failed > 0
          ? `${r.succeeded} updated, ${r.failed} failed.`
          : `${r.succeeded} user${r.succeeded === 1 ? '' : 's'} ${status === 'SUSPENDED' ? 'suspended' : 'reactivated'}.`,
      );
      setSelected(new Set());
      setReason('');
      router.refresh();
    });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-page.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <Link href={`/admin/users/${u.id}`} className="block">
          <span className="font-medium text-primary hover:underline">{u.name}</span>
          <span className="block text-xs text-muted-foreground">{u.email ?? u.phone ?? '—'}</span>
        </Link>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <RolePill role={u.role} /> },
    { key: 'status', header: 'Status', render: (u) => <UserStatusPill status={u.status} /> },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : `${rows.length} on this page`}
        </p>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-primary hover:border-gold/40"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, ≥10 chars)"
            disabled={pending}
            className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-primary focus:border-teal focus:outline-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => applyBulk('SUSPENDED')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" /> Suspend
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => applyBulk('ACTIVE')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {msg && <p className="mb-3 text-sm text-teal">{msg}</p>}

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(u) => u.id}
        selectable
        selectedKeys={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        empty={{ title: 'No users found', description: 'Try widening your search or clearing filters.' }}
      />
    </div>
  );
}
