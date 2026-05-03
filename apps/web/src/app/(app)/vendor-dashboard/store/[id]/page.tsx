import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/store/ProductForm.client';
import { QuickStockForm } from '@/components/store/QuickStockForm.client';
import { DeleteProductButton } from '@/components/store/DeleteProductButton.client';
import type { ProductSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchProduct(
  id: string,
  token: string,
): Promise<ProductSummary | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/products/${id}`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: { product: ProductSummary };
    };
    return json.success ? (json.data?.product ?? null) : null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const product = await fetchProduct(id, token);
  if (!product) notFound();

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-xl mx-auto">
        {/* Back link */}
        <Link
          href="/vendor-dashboard/store"
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0E7C7B] transition-colors mb-5 min-h-[44px]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-[#7B2D42] text-2xl font-bold mb-0.5">
              Edit Product
            </h1>
            <p className="text-[#64748B] text-sm line-clamp-1">{product.name}</p>
          </div>
          <DeleteProductButton productId={product.id} productName={product.name} />
        </div>

        {/* Quick stock update */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-base mb-3">
            Quick Stock Update
          </h2>
          <QuickStockForm productId={product.id} currentStock={product.stockQty} />
        </div>

        {/* Full edit form */}
        <div className="bg-surface border border-[#C5A47E]/20 rounded-xl shadow-sm p-5">
          <h2 className="font-heading text-[#7B2D42] font-semibold text-base mb-4">
            Product Details
          </h2>
          <ProductForm
            mode="edit"
            productId={product.id}
            defaultValues={{
              name:         product.name,
              description:  product.description ?? undefined,
              category:     product.category,
              price:        product.price,
              comparePrice: product.comparePrice ?? undefined,
              stockQty:     product.stockQty,
              isFeatured:   product.isFeatured,
            }}
          />
        </div>
      </div>
    </main>
  );
}
