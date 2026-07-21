import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { CheckoutForm } from '@/components/store/CheckoutForm.client';

export default async function CheckoutPage() {
  const t = await getTranslations('store');
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/store/cart"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-teal transition-colors text-sm min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('cart.title')}
          </Link>
          <h1 className="font-heading text-primary text-xl font-bold">{t('checkout.title')}</h1>
        </div>

        <CheckoutForm />
      </div>
    </main>
  );
}
