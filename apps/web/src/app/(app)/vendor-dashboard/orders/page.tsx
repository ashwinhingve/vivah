import Link from 'next/link';
import { cookies } from 'next/headers';
import { VendorOrderRow } from '@/components/store/VendorOrderRow.client';
import type { VendorOrderItem } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

type StatusFilter = 'ALL' | 'PENDING' | 'SHIPPED' | 'DELIVERED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Shipped',   value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
];

async function fetchVendorOrders(token: string): Promise<VendorOrderItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/store/vendor/orders`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      success: boolean;
      data: { items: VendorOrderItem[] };
    };
    return json.success ? (json.data?.items ?? []) : [];
  } catch {
    return [];
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function VendorOrdersPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value ?? '';

  const params = await searchParams;
  const rawStatus = (params.status ?? 'ALL').toUpperCase() as StatusFilter;
  const activeFilter: StatusFilter = STATUS_TABS.some((t) => t.value === rawStatus)
    ? rawStatus
    : 'ALL';

  const allItems = await fetchVendorOrders(token);

  const filteredItems =
    activeFilter === 'ALL'
      ? allItems
      : allItems.filter((i) => i.fulfilmentStatus === activeFilter);

  const pendingCount = allItems.filter((i) => i.fulfilmentStatus === 'PENDING').length;
  const shippedCount = allItems.filter((i) => i.fulfilmentStatus === 'SHIPPED').length;
  const deliveredCount = allItems.filter((i) => i.fulfilmentStatus === 'DELIVERED').length;

  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-[#7B2D42] text-2xl font-bold mb-0.5">
            Orders
          </h1>
          <p className="text-[#64748B] text-sm">Fulfil and track customer orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-[#C5A47E]/30 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#64748B] font-medium uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold font-heading text-amber-600">{pendingCount}</p>
            <p className="text-xs text-[#94A3B8]">to ship</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/30 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#64748B] font-medium uppercase tracking-wide">Shipped</p>
            <p className="text-2xl font-bold font-heading text-purple-600">{shippedCount}</p>
            <p className="text-xs text-[#94A3B8]">in transit</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/30 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#64748B] font-medium uppercase tracking-wide">Delivered</p>
            <p className="text-2xl font-bold font-heading text-emerald-600">{deliveredCount}</p>
            <p className="text-xs text-[#94A3B8]">completed</p>
          </div>
          <div className="rounded-xl border border-[#C5A47E]/30 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs text-[#64748B] font-medium uppercase tracking-wide">Revenue</p>
            <p className="text-2xl font-bold font-heading text-[#C5A47E]">—</p>
            <p className="text-xs text-[#94A3B8]">coming soon</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {STATUS_TABS.map(({ label, value }) => {
            const isActive = activeFilter === value;
            return (
              <Link
                key={value}
                href={value === 'ALL' ? '/vendor-dashboard/orders' : `?status=${value.toLowerCase()}`}
                className={`shrink-0 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center ${
                  isActive
                    ? 'bg-[#0E7C7B] text-white'
                    : 'bg-white border border-[#C5A47E]/20 text-[#64748B] hover:border-[#0E7C7B] hover:text-[#0E7C7B]'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Order list */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C5A47E]/30 bg-white py-16 flex flex-col items-center gap-3 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-[#C5A47E]/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <p className="font-heading text-[#7B2D42] font-semibold text-lg">
              {activeFilter === 'ALL' ? 'No orders yet' : `No ${activeFilter.toLowerCase()} orders`}
            </p>
            <p className="text-[#64748B] text-sm max-w-xs">
              {activeFilter === 'ALL'
                ? 'Orders will appear here once customers purchase your products.'
                : `No orders with ${activeFilter.toLowerCase()} status at the moment.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <VendorOrderRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
