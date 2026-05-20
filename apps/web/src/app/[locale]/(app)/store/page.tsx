import Link from 'next/link';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/store/ProductGrid';
import { StoreCategoryFilter } from '@/components/store/StoreCategoryFilter.client';
import type { ProductSummary } from '@smartshaadi/types';

const API_URL  = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PAGE_SIZE = 12;

interface ProductsApiResponse {
  success: boolean;
  data: {
    products: ProductSummary[];
    meta: { page: number; total: number; limit: number };
  };
}

interface PageProps {
  searchParams: Promise<{
    category?: string;
    search?:   string;
    page?:     string;
  }>;
}

async function fetchProducts(params: {
  category?: string;
  search?:   string;
  page:      number;
}): Promise<{ products: ProductSummary[]; total: number }> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.search)   query.set('search', params.search);
  query.set('page',    String(params.page));
  query.set('limit',   String(PAGE_SIZE));

  try {
    const res = await fetch(`${API_URL}/api/v1/store/products?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { products: [], total: 0 };
    const json = (await res.json()) as ProductsApiResponse;
    return {
      products: json.success ? (json.data?.products ?? []) : [],
      total:    json.success ? (json.data?.meta?.total ?? 0) : 0,
    };
  } catch {
    return { products: [], total: 0 };
  }
}

async function fetchFeatured(): Promise<ProductSummary[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/products/featured`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: { products: ProductSummary[] } };
    return json.success ? (json.data?.products ?? []) : [];
  } catch {
    return [];
  }
}

export default async function StorePage({ searchParams }: PageProps) {
  const params   = await searchParams;
  const category = params.category ?? '';
  const search   = params.search   ?? '';
  const page     = Math.max(1, parseInt(params.page ?? '1', 10));

  const [{ products, total }, featured] = await Promise.all([
    fetchProducts({ category, search, page }),
    page === 1 && !category && !search ? fetchFeatured() : Promise.resolve([] as ProductSummary[]),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-primary text-2xl font-bold mb-1">Wedding Store</h1>
          <p className="text-muted-foreground text-sm">Gifts, trousseau, ethnic wear & more</p>
        </div>

        {/* Filters */}
        <Suspense fallback={null}>
          <StoreCategoryFilter activeCategory={category} searchQuery={search} />
        </Suspense>

        {/* Featured section */}
        {featured.length > 0 && (
          <section className="mb-8">
            <h2 className="font-heading text-primary font-semibold text-lg mb-3">Featured</h2>
            <ProductGrid products={featured} />
          </section>
        )}

        {/* All products */}
        <section>
          {category || search ? null : (
            <h2 className="font-heading text-primary font-semibold text-lg mb-3">
              All Products
              {total > 0 && <span className="text-muted-foreground font-normal text-sm ml-2">({total})</span>}
            </h2>
          )}
          <ProductGrid products={products} />
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {page > 1 && (
              <Link
                href={`/store?${new URLSearchParams({ ...(category && { category }), ...(search && { search }), page: String(page - 1) }).toString()}`}
                className="px-4 py-2 min-h-[44px] flex items-center text-sm font-medium border border-gold/30 rounded-lg text-muted-foreground hover:border-teal hover:text-teal transition-colors"
              >
                ← Previous
              </Link>
            )}
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/store?${new URLSearchParams({ ...(category && { category }), ...(search && { search }), page: String(page + 1) }).toString()}`}
                className="px-4 py-2 min-h-[44px] flex items-center text-sm font-medium border border-gold/30 rounded-lg text-muted-foreground hover:border-teal hover:text-teal transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
