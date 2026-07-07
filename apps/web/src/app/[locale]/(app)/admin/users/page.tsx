/**
 * Admin User Directory — search + filter across every account on the
 * platform. Server Component. Fetches /api/v1/admin/users
 * (apps/api/src/admin/users.router.ts) and renders a paginated, filterable
 * table linking to per-user detail pages.
 */
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { UserRole, UserStatus } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { RolePill, UserStatusPill } from '@/components/admin/badges';
import { UserFilters } from './UserFilters.client';

export const dynamic = 'force-dynamic';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.role) qs.set('role', sp.role);
  if (sp.status) qs.set('status', sp.status);
  qs.set('page', String(page));
  qs.set('limit', String(PAGE_SIZE));

  const data = await fetchAuth<{ items: UserRow[]; total: number; page: number; limit: number }>(
    `/api/v1/admin/users?${qs.toString()}`,
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  function pageHref(p: number): string {
    const next = new URLSearchParams(qs);
    next.set('page', String(p));
    return `/admin/users?${next.toString()}`;
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
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Admin Console
        </Link>

        <FadeUp>
          <PageHeader
            title="User Management"
            subtitle={`${total} account${total === 1 ? '' : 's'} on the platform.`}
            breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
          />
        </FadeUp>

        <FadeUp>
          <UserFilters
            initialQ={sp.q ?? ''}
            initialRole={sp.role ?? ''}
            initialStatus={sp.status ?? ''}
          />
        </FadeUp>

        <FadeUp>
          <div className="mt-4">
            <DataTable
              columns={columns}
              data={rows}
              rowKey={(u) => u.id}
              empty={{
                title: 'No users found',
                description: sp.q || sp.role || sp.status
                  ? 'Try widening your search or clearing filters.'
                  : 'No accounts on the platform yet.',
              }}
            />
          </div>

          {hasNext || hasPrev ? (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {hasPrev ? (
                <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 text-teal hover:underline">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : <span />}
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              {hasNext ? (
                <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 text-teal hover:underline">
                  Next <ArrowRight className="h-4 w-4" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
