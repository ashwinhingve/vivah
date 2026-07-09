/**
 * Admin User Directory — search + filter across every account on the
 * platform. Server Component. Fetches /api/v1/admin/users
 * (apps/api/src/admin/users.router.ts) and renders a paginated, filterable
 * table linking to per-user detail pages.
 */
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import type { UserRole, UserStatus } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { UserFilters } from './UserFilters.client';
import { UsersTable } from './UsersTable.client';

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
  const t = await getTranslations('adminRole');
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

  return (
    <PageTransition>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary min-h-[44px] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.adminConsole')}
        </Link>

        <FadeUp>
          <PageHeader
            title={t('users.title')}
            subtitle={t('users.subtitle', { count: total })}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('users.breadcrumb') }]}
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
            <UsersTable rows={rows} />
          </div>

          {hasNext || hasPrev ? (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {hasPrev ? (
                <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 text-teal hover:underline">
                  <ChevronLeft className="h-4 w-4" /> {t('common.previous')}
                </Link>
              ) : <span />}
              <span className="text-xs text-muted-foreground">
                {t('common.pageOf', { page, total: Math.max(1, Math.ceil(total / PAGE_SIZE)) })}
              </span>
              {hasNext ? (
                <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 text-teal hover:underline">
                  {t('common.next')} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </FadeUp>
      </main>
    </PageTransition>
  );
}
