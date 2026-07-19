/**
 * Premium packages browse — Phase 8, Unit 8.1.
 *
 * Filters live entirely in the URL (city, tier, capacity, price, sort, page) so
 * a filtered view is shareable and the back button works. Follows the pattern
 * established by (app)/vendors/page.tsx.
 *
 * Nothing here reads `isPlaceholder`. Seeded inventory renders exactly like real
 * inventory — the flag only gates the booking CTA, and that decision is made by
 * the server on the detail page, not here.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { PremiumPackageListResult, PremiumPackageFacets } from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { Link } from '@/i18n/navigation';
import { PackageCard } from './PackageCard';
import { PackageFilters } from './PackageFilters.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PAGE_SIZE = 12;

// Every filter the API accepts. Kept as one list so the pagination links below
// cannot drop a filter the results were computed with.
const FILTER_KEYS = ['q', 'city', 'tier', 'capacity', 'priceMin', 'priceMax', 'sort'] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function fetchPackages(
  params: Record<string, string | undefined>,
): Promise<PremiumPackageListResult> {
  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = params[k];
    if (v) query.set(k, v);
  }
  query.set('page', params['page'] ?? '1');
  query.set('limit', String(PAGE_SIZE));

  const empty: PremiumPackageListResult = {
    packages: [], total: 0, page: 1, limit: PAGE_SIZE,
  };

  try {
    // Public endpoint — no session cookie needed, so an anonymous visitor
    // browses the catalogue without being bounced to sign-in.
    const res = await fetch(`${API_BASE}/api/v1/packages?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { data?: PremiumPackageListResult };
    return json.data ?? empty;
  } catch {
    return empty;
  }
}

async function fetchFacets(): Promise<PremiumPackageFacets> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/packages/facets`, { cache: 'no-store' });
    if (!res.ok) return { cities: [], tiers: [] };
    const json = (await res.json()) as { data?: PremiumPackageFacets };
    return json.data ?? { cities: [], tiers: [] };
  } catch {
    return { cities: [], tiers: [] };
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'packages.list.metadata' });
  return { title: t('title'), description: t('description') };
}

export const dynamic = 'force-dynamic';

export default async function PackagesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations('packages.list');

  const page = Math.max(1, parseInt(params['page'] ?? '1', 10) || 1);
  const [result, facets] = await Promise.all([fetchPackages(params), fetchFacets()]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Rebuilds the URL preserving every active filter — dropping one here would
  // silently change the result set between pages.
  function pageHref(p: number): string {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params[k];
      if (v) q.set(k, v);
    }
    q.set('page', String(p));
    return `/packages?${q.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle', { count: result.total })}
          />

          <PackageFilters facets={facets} />

          {result.packages.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-gold/30 bg-surface p-10 text-center shadow-card">
              <p className="font-heading text-xl text-primary">{t('empty.title')}</p>
              <p className="mt-2 text-muted">{t('empty.body')}</p>
              <Link
                href="/packages"
                className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-surface transition hover:opacity-90"
              >
                {t('empty.clear')}
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.packages.map((pkg) => (
                  <li key={pkg.id}>
                    <PackageCard pkg={pkg} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-3"
                  aria-label={t('pagination.label')}
                >
                  {hasPrev && (
                    <Link
                      href={pageHref(page - 1)}
                      className="inline-flex h-11 items-center rounded-lg border border-gold/40 px-5 text-primary transition hover:bg-gold/10"
                    >
                      {t('pagination.prev')}
                    </Link>
                  )}
                  <span className="text-sm text-muted">
                    {t('pagination.status', { page, totalPages })}
                  </span>
                  {hasNext && (
                    <Link
                      href={pageHref(page + 1)}
                      className="inline-flex h-11 items-center rounded-lg border border-gold/40 px-5 text-primary transition hover:bg-gold/10"
                    >
                      {t('pagination.next')}
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
