/**
 * Admin — premium package management (Phase 8, Unit 8.1).
 *
 * Lists ALL packages including inactive ones, which the public browse excludes.
 * The operator's two jobs here are promoting seeded inventory to a real partner
 * (the placeholder toggle) and taking a listing off the catalogue.
 *
 * Role is enforced by the API (authorize(['ADMIN'])); a non-admin session gets
 * an empty list rather than a partial render, because the fetch 403s.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { PremiumPackageListResult } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { AdminPackageTable } from './AdminPackageTable.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchAll(): Promise<{ result: PremiumPackageListResult; forbidden: boolean }> {
  const empty: PremiumPackageListResult = { packages: [], total: 0, page: 1, limit: 100 };
  try {
    const store = await cookies();
    const token = store.get('better-auth.session_token')?.value ?? '';
    const res = await fetch(`${API_BASE}/api/v1/packages/admin?limit=100`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    // Distinguish "not allowed" from "nothing here" so the page can say which.
    if (res.status === 403 || res.status === 401) return { result: empty, forbidden: true };
    if (!res.ok) return { result: empty, forbidden: false };
    const json = (await res.json()) as { data?: PremiumPackageListResult };
    return { result: json.data ?? empty, forbidden: false };
  } catch {
    return { result: empty, forbidden: false };
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adminPackages' });
  return { title: t('metadata.title') };
}

export const dynamic = 'force-dynamic';

export default async function AdminPackagesPage() {
  const t = await getTranslations('adminPackages');
  const { result, forbidden } = await fetchAll();

  const placeholderCount = result.packages.filter((p) => p.isPlaceholder).length;

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle', { total: result.total, placeholder: placeholderCount })}
            breadcrumbs={[{ label: t('breadcrumb.admin'), href: '/admin' }, { label: t('heading') }]}
          />

          {forbidden ? (
            <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <p className="font-heading text-lg text-primary">{t('forbidden.title')}</p>
              <p className="mt-2 text-muted">{t('forbidden.body')}</p>
            </div>
          ) : (
            <>
              {placeholderCount > 0 && (
                <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/5 p-4 sm:p-6">
                  <p className="font-heading text-primary">{t('seedBanner.title')}</p>
                  <p className="mt-1 text-sm text-muted">
                    {t('seedBanner.body', { count: placeholderCount })}
                  </p>
                </div>
              )}
              <AdminPackageTable packages={result.packages} />
            </>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
