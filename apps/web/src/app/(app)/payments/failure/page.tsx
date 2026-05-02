import Link from 'next/link';

interface SearchParams { reason?: string; bookingId?: string; orderId?: string }

export const dynamic = 'force-dynamic';

export default async function PaymentFailurePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white">!</div>
        <h1 className="mb-2 text-2xl font-semibold text-red-900">Payment failed</h1>
        <p className="mb-4 text-red-800">{params.reason ?? 'Your payment could not be completed.'}</p>
        <p className="mb-6 text-sm text-red-700">No money has been deducted. If your bank shows a charge, it will reverse within 5–7 business days.</p>
        <div className="mt-6 flex justify-center gap-3">
          {params.bookingId ? (
            <Link href={`/bookings/${params.bookingId}`} className="rounded-lg bg-[#0A1F4D] px-4 py-2 text-white hover:bg-[#1848C8]">Retry payment</Link>
          ) : null}
          <Link href="/payments" className="rounded-lg border border-[#0A1F4D] px-4 py-2 text-[#0A1F4D] hover:bg-[#0A1F4D]/5">All payments</Link>
        </div>
      </div>
    </main>
  );
}
