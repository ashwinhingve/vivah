import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { CartPageClient } from '@/components/store/CartPageClient.client';

export default function CartPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-teal transition-colors text-sm min-h-[44px]"
            aria-label="Back to store"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Store
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">Your Cart</h1>
        </div>

        <CartPageClient />
      </div>
    </main>
  );
}
