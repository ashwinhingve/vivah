import Link from 'next/link';
import { CheckoutForm } from '@/components/store/CheckoutForm.client';

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/store/cart"
            className="text-[#64748B] hover:text-[#0E7C7B] transition-colors text-sm"
          >
            ← Cart
          </Link>
          <h1 className="font-heading text-[#7B2D42] text-xl font-bold">Checkout</h1>
        </div>

        <CheckoutForm />
      </div>
    </main>
  );
}
