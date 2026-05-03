import Link from 'next/link';

interface SearchParams { paymentId?: string; bookingId?: string; subscriptionId?: string }

export const dynamic = 'force-dynamic';

export default async function PaymentSuccessPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-xl border border-success/30 bg-success/10 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success text-3xl text-white">✓</div>
        <h1 className="mb-2 text-2xl font-semibold text-success">Payment successful</h1>
        <p className="mb-6 text-success">Your transaction has been recorded. Thank you.</p>
        {params.paymentId ? (
          <p className="mb-2 text-sm text-success">Payment ID: <code className="bg-surface px-2 py-1 rounded">{params.paymentId}</code></p>
        ) : null}
        {params.bookingId ? (
          <p className="mb-2 text-sm text-success">Booking: <code className="bg-surface px-2 py-1 rounded">{params.bookingId.slice(0, 8)}…</code></p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          {params.bookingId ? (
            <Link href={`/bookings/${params.bookingId}`} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-teal">View booking</Link>
          ) : null}
          <Link href="/payments" className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/5">All payments</Link>
        </div>
      </div>
    </main>
  );
}
