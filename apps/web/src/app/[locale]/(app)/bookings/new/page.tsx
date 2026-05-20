import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { VendorProfile } from '@smartshaadi/types';
import type { PortfolioDoc, PortfolioPackage } from '@/components/vendor/VendorPortfolio';
import { BookingForm } from '@/components/bookings/BookingForm.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface VendorDetailResponse {
  success: boolean;
  data: VendorProfile & { portfolio: PortfolioDoc | null };
}

interface PageProps {
  searchParams: Promise<{ vendorId?: string }>;
}

async function fetchVendor(id: string): Promise<(VendorProfile & { portfolio: PortfolioDoc | null }) | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as VendorDetailResponse;
    return json.success ? json.data : null;
  } catch { return null; }
}

export default async function NewBookingPage({ searchParams }: PageProps) {
  const { vendorId } = await searchParams;
  if (!vendorId) {
    redirect('/vendors');
  }

  const vendor = await fetchVendor(vendorId);
  if (!vendor) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-base font-medium text-primary">Vendor not found</p>
        <Link href="/vendors" className="text-sm text-teal underline">Back to vendors</Link>
      </main>
    );
  }

  const packages: { name: string; price: number; inclusions?: string[] }[] = (vendor.portfolio?.packages ?? [])
    .filter((p): p is PortfolioPackage & { name: string; price: number } => !!p.name && typeof p.price === 'number')
    .map((p) => {
      const out: { name: string; price: number; inclusions?: string[] } = { name: p.name as string, price: p.price as number };
      if (Array.isArray(p.inclusions) && p.inclusions.length > 0) {
        out.inclusions = p.inclusions;
      }
      return out;
    });

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <Link href={`/vendors/${vendor.id}`} className="text-sm text-muted-foreground hover:text-teal">
          ← Back to {vendor.businessName}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-primary font-heading">Book {vendor.businessName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vendor.category.replace(/_/g, ' ').toLowerCase()} · {vendor.city}, {vendor.state}
          </p>
        </div>
        <BookingForm vendor={vendor} packages={packages} />
      </div>
    </main>
  );
}
