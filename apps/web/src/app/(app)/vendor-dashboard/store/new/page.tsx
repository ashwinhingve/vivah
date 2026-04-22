import Link from 'next/link';
import { ProductForm } from '@/components/store/ProductForm.client';

export default function NewProductPage() {
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
        <div className="mb-6">
          <h1 className="font-heading text-[#7B2D42] text-2xl font-bold mb-0.5">
            Add New Product
          </h1>
          <p className="text-[#64748B] text-sm">
            Fill in the details below to list a product on the Smart Shaadi store.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5">
          <ProductForm mode="create" />
        </div>
      </div>
    </main>
  );
}
