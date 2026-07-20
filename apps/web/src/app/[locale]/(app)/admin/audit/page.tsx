/**
 * Admin Audit Log Console.
 * Server Component. Fetches /api/v1/admin/audit and renders a filterable,
 * paginated view into the append-only, hash-chained audit trail
 * (apps/api/src/admin/audit.router.ts).
 */
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/redirect';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';
import { fetchAuth } from '@/lib/server-fetch';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { AuditFilters } from './AuditFilters.client';
import { AuditExportButton } from './AuditExportButton.client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminRole' });
  return { title: `${t('navTiles.audit.label')} — Admin | Smart Shaadi` };
}

interface AuditRow {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  payload: unknown;
  createdAt: string;
}

const PAGE_SIZE = 20;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Coarse tone classification from the event-type name — the enum has 40+
// values (see AuditFilters.client.tsx); grouping by outcome keyword keeps a
// single pill palette instead of a 40-entry lookup table.
function eventTone(eventType: string): string {
  if (/FAILED|REJECTED|DISPUTED|SUSPENDED|CANCELLED|DUPLICATE|BLOCKED|REPORTED/.test(eventType)) {
    return 'bg-destructive/10 text-destructive border-destructive/30';
  }
  if (/APPROVED|VERIFIED|COMPLETED|RESOLVED|CONFIRMED|PAID|REINSTATED|RELEASED|SIGNED/.test(eventType)) {
    return 'bg-success/10 text-success border-success/30';
  }
  if (/PENDING|REQUESTED|HELD|INITIATED|UNDER_REVIEW|SUBMITTED|RAISED/.test(eventType)) {
    return 'bg-warning/10 text-warning border-warning/30';
  }
  return 'bg-teal/10 text-teal border-teal/20';
}

function PayloadPreview({ payload }: { payload: unknown }) {
  if (payload == null) return <span className="text-xs text-muted-foreground">—</span>;
  const json = JSON.stringify(payload);
  const preview = json.length > 60 ? `${json.slice(0, 60)}…` : json;
  return (
    <code className="block max-w-[220px] truncate text-xs text-muted-foreground" title={json}>
      {preview}
    </code>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    eventType?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const t = await getTranslations('adminRole');
  const me = await fetchAuth<{ userId: string; role: string }>('/api/auth/me');
  if (me && me.role !== 'ADMIN') {
    return await redirect('/dashboard');
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams();
  if (sp.eventType) qs.set('eventType', sp.eventType);
  if (sp.entityType) qs.set('entityType', sp.entityType);
  if (sp.entityId) qs.set('entityId', sp.entityId);
  if (sp.actorId) qs.set('actorId', sp.actorId);
  if (sp.from) qs.set('from', sp.from);
  if (sp.to) qs.set('to', sp.to);
  qs.set('page', String(page));
  qs.set('limit', String(PAGE_SIZE));

  const data = await fetchAuth<{ items: AuditRow[]; total: number; page: number; limit: number }>(
    `/api/v1/admin/audit?${qs.toString()}`,
  );
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  function pageHref(p: number): string {
    const next = new URLSearchParams(qs);
    next.set('page', String(p));
    return `/admin/audit?${next.toString()}`;
  }

  const columns: DataTableColumn<AuditRow>[] = [
    {
      key: 'eventType',
      header: t('audit.table.colEvent'),
      render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${eventTone(r.eventType)}`}>
          {r.eventType}
        </span>
      ),
    },
    {
      key: 'entityType',
      header: t('audit.table.colEntity'),
      render: (r) => (
        <span className="text-sm text-foreground">
          {r.entityType} <span className="text-xs text-muted-foreground">#{r.entityId.slice(0, 8)}</span>
        </span>
      ),
    },
    {
      key: 'actorName',
      header: t('audit.table.colActor'),
      render: (r) => r.actorName ?? <span className="text-muted-foreground">{t('common.system')}</span>,
    },
    { key: 'createdAt', header: t('audit.table.colWhen'), render: (r) => relativeTime(r.createdAt) },
    { key: 'payload', header: t('audit.table.colDetails'), render: (r) => <PayloadPreview payload={r.payload} /> },
  ];

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
            title={t('audit.title')}
            subtitle={t('audit.subtitle', { count: total })}
            breadcrumbs={[{ label: t('common.breadcrumbAdmin'), href: '/admin' }, { label: t('audit.breadcrumb') }]}
          />
        </FadeUp>

        <FadeUp>
          <AuditFilters
            initialEventType={sp.eventType ?? ''}
            initialEntityType={sp.entityType ?? ''}
            initialEntityId={sp.entityId ?? ''}
            initialActorId={sp.actorId ?? ''}
            initialFrom={sp.from ?? ''}
            initialTo={sp.to ?? ''}
          />
          <div className="mt-3 flex justify-end">
            <AuditExportButton rows={rows} />
          </div>
        </FadeUp>

        <FadeUp>
          <div className="mt-4">
            <DataTable
              columns={columns}
              data={rows}
              rowKey={(r) => r.id}
              empty={{
                title: t('audit.table.emptyTitle'),
                description: sp.eventType || sp.entityType || sp.from || sp.to
                  ? t('audit.table.emptyFiltered')
                  : t('audit.table.emptyDefault'),
              }}
            />
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
