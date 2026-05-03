import { notFound } from 'next/navigation';
import { AddToCartButton } from '@/components/store/AddToCartButton.client';
import { ProductGrid } from '@/components/store/ProductGrid';
import type { ProductSummary } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface ProductDetail extends ProductSummary {
  images?: string[];
}

interface PageProps {
  params: Promise<{ productId: string }>;
}

async function fetchProduct(id: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/products/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: ProductDetail };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function fetchRelated(category: string, excludeId: string): Promise<ProductSummary[]> {
  try {
    const query = new URLSearchParams({ category, limit: '4' });
    const res = await fetch(`${API_URL}/api/v1/store/products?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { products: ProductSummary[] };
    };
    return json.success
      ? (json.data?.products ?? []).filter(p => p.id !== excludeId).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function stockLabel(qty: number) {
  if (qty === 0) return { text: 'Out of Stock', cls: 'text-destructive bg-destructive/10' };
  if (qty < 5)  return { text: `Low Stock (${qty} left)`, cls: 'text-amber-700 bg-amber-50' };
  return { text: 'In Stock', cls: 'text-emerald-700 bg-emerald-50' };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const [product, related] = await Promise.all([
    fetchProduct(productId),
    fetchProduct(productId).then(p =>
      p ? fetchRelated(p.category, productId) : []
    ),
  ]);

  if (!product) notFound();

  const stock  = stockLabel(product.stockQty);
  const images = product.images?.length
    ? product.images
    : product.imageKey
    ? [product.imageKey]
    : [];

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-xs text-[#64748B] mb-4 flex items-center gap-1.5">
          <a href="/store" className="hover:text-[#0E7C7B] transition-colors">Store</a>
          <span>/</span>
          <span className="text-[#0F172A] truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image gallery */}
          <div className="space-y-2">
            <div className="aspect-square rounded-xl overflow-hidden bg-surface border border-[#C5A47E]/20">
              {images.length > 0 ? (
                <img
                  src={`/api/r2/${encodeURIComponent(images[0]!)}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#C5A47E]/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.slice(1).map((key, i) => (
                  <div key={i} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-[#C5A47E]/20">
                    <img
                      src={`/api/r2/${encodeURIComponent(key)}`}
                      alt={`${product.name} ${i + 2}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Category */}
            <span className="inline-block text-xs font-medium bg-[#C5A47E]/10 text-[#C5A47E] px-2 py-0.5 rounded-full">
              {product.category}
            </span>

            {/* Name */}
            <h1 className="font-heading text-[#7B2D42] text-xl font-bold leading-snug">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#0E7C7B]">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.comparePrice && product.comparePrice > product.price && (
                <>
                  <span className="text-base text-[#94A3B8] line-through">
                    ₹{product.comparePrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {Math.round((1 - product.price / product.comparePrice) * 100)}% off
                  </span>
                </>
              )}
            </div>

            {/* Stock */}
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${stock.cls}`}>
              {stock.text}
            </span>

            {/* Featured */}
            {product.isFeatured && (
              <span className="block text-xs font-semibold text-[#C5A47E]">⭐ Featured Product</span>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-sm text-[#64748B] leading-relaxed">{product.description}</p>
            )}

            {/* Vendor */}
            <p className="text-xs text-[#64748B]">
              Sold by <span className="font-medium text-[#0F172A]">{product.vendorName}</span>
            </p>

            {/* Add to cart */}
            <AddToCartButton product={product} />
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-heading text-[#7B2D42] font-semibold text-lg mb-4">
              You might also like
            </h2>
            <ProductGrid products={related} />
          </section>
        )}
      </div>
    </main>
  );
}
