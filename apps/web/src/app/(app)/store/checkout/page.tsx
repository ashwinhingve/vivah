import Link from 'next/link';
import { CheckoutForm } from '@/components/store/CheckoutForm.client';

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/store/cart"
            className="text-muted-foreground hover:text-teal transition-colors text-sm"
          >
            ← Cart
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">Checkout</h1>
        </div>

        <CheckoutForm />
      </div>
    </main>
  );
}
