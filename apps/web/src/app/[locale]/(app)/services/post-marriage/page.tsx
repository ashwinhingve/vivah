/**
 * Post-marriage services browse — Phase 8, Unit 8.2.
 *
 * Sits under (app)/services/ alongside lending and insurance, following the
 * placement-shell shape those two established. Filters live in the URL, same as
 * the 8.1 browse.
 *
 * Categories come from the database, not a constant in this file — an operator
 * adds "pet care" from the admin UI and it appears here without a deploy.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type {
  PostMarriageServiceListResult,
  PostMarriageCategoryWithCount,
} from '@smartshaadi/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/motion/PageTransition.client';
import { Link } from '@/i18n/navigation';
import { ServiceCard } from './ServiceCard';
import { ServiceFilters } from './ServiceFilters.client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PAGE_SIZE = 12;

const FILTER_KEYS = ['q', 'category', 'city', 'priceMin', 'priceMax', 'sort'] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

async function fetchServices(
  params: Record<string, string | undefined>,
): Promise<PostMarriageServiceListResult> {
  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = params[k];
    if (v) query.set(k, v);
  }
  query.set('page', params['page'] ?? '1');
  query.set('limit', String(PAGE_SIZE));

  const empty: PostMarriageServiceListResult = {
    services: [], total: 0, page: 1, limit: PAGE_SIZE,
  };

  try {
    const res = await fetch(
      `${API_BASE}/api/v1/post-marriage/services?${query.toString()}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return empty;
    const json = (await res.json()) as { data?: PostMarriageServiceListResult };
    return json.data ?? empty;
  } catch {
    return empty;
  }
}

async function fetchCategories(): Promise<PostMarriageCategoryWithCount[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/post-marriage/categories`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { categories?: PostMarriageCategoryWithCount[] };
    };
    return json.data?.categories ?? [];
  } catch {
    return [];
  }
}

async function fetchCities(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/post-marriage/services/cities`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { cities?: string[] } };
    return json.data?.cities ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'postMarriage.list.metadata' });
  return { title: t('title'), description: t('description') };
}

export const dynamic = 'force-dynamic';

export default async function PostMarriagePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations('postMarriage.list');

  const page = Math.max(1, parseInt(params['page'] ?? '1', 10) || 1);
  const [result, categories, cities] = await Promise.all([
    fetchServices(params), fetchCategories(), fetchCities(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function pageHref(p: number): string {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = params[k];
      if (v) q.set(k, v);
    }
    q.set('page', String(p));
    return `/services/post-marriage?${q.toString()}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8">
        <PageTransition>
          <PageHeader
            title={t('heading')}
            subtitle={t('subtitle', { count: result.total })}
          />

          <ServiceFilters categories={categories} cities={cities} />

          {result.services.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-gold/30 bg-surface p-10 text-center shadow-card">
              <p className="font-heading text-xl text-primary">{t('empty.title')}</p>
              <p className="mt-2 text-muted">{t('empty.body')}</p>
              <Link
                href="/services/post-marriage"
                className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-surface transition hover:opacity-90"
              >
                {t('empty.clear')}
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.services.map((svc) => (
                  <li key={svc.id}>
                    <ServiceCard service={svc} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-3"
                  aria-label={t('pagination.label')}
                >
                  {page > 1 && (
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
                  {page < totalPages && (
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
