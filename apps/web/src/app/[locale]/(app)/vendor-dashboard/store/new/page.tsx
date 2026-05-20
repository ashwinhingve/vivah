import Link from 'next/link';
import { ProductForm } from '@/components/store/ProductForm.client';

export default function NewProductPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-xl mx-auto">
        {/* Back link */}
        <Link
          href="/vendor-dashboard/store"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-teal transition-colors mb-5 min-h-[44px]"
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
        <div className="mb-6">
          <h1 className="font-heading text-primary text-2xl font-bold mb-0.5">
            Add New Product
          </h1>
          <p className="text-muted-foreground text-sm">
            Fill in the details below to list a product on the Smart Shaadi store.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5">
          <ProductForm mode="create" />
        </div>
      </div>
    </main>
  );
}
