import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CheckCircle } from 'lucide-react';

interface SearchParams { paymentId?: string; bookingId?: string; subscriptionId?: string }

export const dynamic = 'force-dynamic';

export default async function PaymentSuccessPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const t = await getTranslations('payments.success');
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-success/30 bg-success/10 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
          <CheckCircle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-2 font-heading text-2xl font-semibold text-success">{t('heading')}</h1>
        <p className="mb-6 text-success">{t('message')}</p>
        {params.paymentId ? (
          <p className="mb-2 text-sm text-success">{t('paymentId')}: <code className="bg-surface px-2 py-1 rounded">{params.paymentId}</code></p>
        ) : null}
        {params.bookingId ? (
          <p className="mb-2 text-sm text-success">{t('booking')}: <code className="bg-surface px-2 py-1 rounded">{params.bookingId.slice(0, 8)}…</code></p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          {params.bookingId ? (
            <Link href={`/bookings/${params.bookingId}`} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-teal min-h-[44px] inline-flex items-center">{t('viewBooking')}</Link>
          ) : null}
          <Link href="/payments" className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/5 min-h-[44px] inline-flex items-center">{t('allPayments')}</Link>
        </div>
      </div>
    </main>
  );
}
