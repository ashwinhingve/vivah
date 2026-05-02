import { cookies } from 'next/headers';
import Link from 'next/link';
import { VendorCard } from '@/components/vendor/VendorCard';
import type { VendorProfile } from '@smartshaadi/types';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface FavoritesResponse {
  success: boolean;
  data: { vendors: VendorProfile[] };
}

async function fetchFavorites(): Promise<VendorProfile[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/favorites`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as FavoritesResponse;
    return json.success ? (json.data?.vendors ?? []) : [];
  } catch { return []; }
}

export default async function FavoritesPage() {
  const vendors = await fetchFavorites();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Saved Vendors</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your shortlist of favorite vendors.</p>
        </div>

        {vendors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gold/30 bg-surface p-12 text-center">
            <p className="text-base font-medium text-primary">No favorites yet</p>
            <p className="text-sm text-muted-foreground mt-1">Tap the heart icon on a vendor to save them here.</p>
            <Link
              href="/vendors"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal hover:bg-teal-hover text-white text-sm font-medium px-4 py-2"
            >
              Browse vendors
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((v) => <VendorCard key={v.id} vendor={v} />)}
          </div>
        )}
      </div>
    </main>
  );
}
