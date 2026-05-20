import Link from 'next/link';
import { CartPageClient } from '@/components/store/CartPageClient.client';

export default function CartPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/store"
            className="text-muted-foreground hover:text-teal transition-colors text-sm"
            aria-label="Back to store"
          >
            ← Store
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">Your Cart</h1>
        </div>

        <CartPageClient />
      </div>
    </main>
  );
}
