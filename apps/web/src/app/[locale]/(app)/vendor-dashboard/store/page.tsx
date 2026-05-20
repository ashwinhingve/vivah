import Link from 'next/link';
import { cookies } from 'next/headers';
import { VendorProductCard } from '@/components/store/VendorProductCard';
import type { ProductSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchVendorProducts(token: string): Promise<ProductSummary[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/vendor/products`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { products: ProductSummary[] };
    };
    return json.success ? (json.data?.products ?? []) : [];
  } catch {
    return [];
  }
}

export default async function VendorStorePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const products = await fetchVendorProducts(token);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;
  const outOfStock = products.filter((p) => p.stockQty === 0).length;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-primary text-2xl font-bold mb-0.5">
              My Products
            </h1>
            <p className="text-muted-foreground text-sm">Manage your store catalogue</p>
          </div>
          <Link
            href="/vendor-dashboard/store/new"
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/90 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-gold/30 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold font-heading text-primary">{totalProducts}</p>
            <p className="text-xs text-muted-foreground">products</p>
          </div>
          <div className="rounded-xl border border-gold/30 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold font-heading text-teal">{activeProducts}</p>
            <p className="text-xs text-muted-foreground">listed</p>
          </div>
          <div className="rounded-xl border border-gold/30 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Out of Stock</p>
            <p className="text-2xl font-bold font-heading text-destructive">{outOfStock}</p>
            <p className="text-xs text-muted-foreground">need restocking</p>
          </div>
          <div className="rounded-xl border border-gold/30 bg-surface p-4 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold font-heading text-gold">—</p>
            <p className="text-xs text-muted-foreground">coming soon</p>
          </div>
        </div>

        {/* Product grid */}
        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gold/30 bg-surface py-16 flex flex-col items-center gap-3 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-gold/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="font-heading text-primary font-semibold text-lg">No products yet</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              Add your first product to start selling on the Smart Shaadi store.
            </p>
            <Link
              href="/vendor-dashboard/store/new"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/90 transition-colors mt-1"
            >
              Add your first product
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <VendorProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
