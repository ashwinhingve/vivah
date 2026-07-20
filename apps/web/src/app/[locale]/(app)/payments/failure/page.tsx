import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AlertCircle } from 'lucide-react';

interface SearchParams { reason?: string; bookingId?: string; orderId?: string }

export const dynamic = 'force-dynamic';

export default async function PaymentFailurePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const t = await getTranslations('payments.failure');
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white">
          <AlertCircle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-2 font-heading text-2xl font-semibold text-destructive">{t('heading')}</h1>
        <p className="mb-4 text-destructive">{params.reason ?? t('defaultMessage')}</p>
        <p className="mb-6 text-sm text-destructive">{t('reassurance')}</p>
        <div className="mt-6 flex justify-center gap-3">
          {params.bookingId ? (
            <Link href={`/bookings/${params.bookingId}`} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-teal min-h-[44px] inline-flex items-center">{t('retryPayment')}</Link>
          ) : null}
          <Link href="/payments" className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/5 min-h-[44px] inline-flex items-center">{t('allPayments')}</Link>
        </div>
      </div>
    </main>
  );
}
