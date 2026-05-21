/**
 * Vendor multi-event pipeline page.
 *
 * Server component. Resolves the signed-in vendor via /api/v1/vendors/me,
 * then fetches the cross-event pipeline + utilization stats from the new
 * vendor engine route. Falls back to empty states if either fetch fails
 * (no auth, no vendor account, infra unreachable).
 */
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/redirect';
import { readSessionCookie } from '@/lib/auth/session-cookie';
import {
  MultiEventPipeline,
  type MultiEventPipelineData,
} from '@/components/vendor/MultiEventPipeline.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function authCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  return token ? `better-auth.session_token=${token}` : null;
}

async function fetchVendorMe(cookie: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors/me`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data: { id: string } | null };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function fetchPipeline(
  cookie: string,
  vendorId: string,
): Promise<MultiEventPipelineData | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/vendor-engine/vendors/${vendorId}/pipeline`,
      { headers: { Cookie: cookie }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success: boolean;
      data: MultiEventPipelineData | null;
    };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function VendorPipelinePage() {
  const cookieStore = await cookies();
  if (!readSessionCookie(cookieStore)) return await redirect('/login');

  const cookie = await authCookie();
  if (!cookie) return await redirect('/login');

  const vendor = await fetchVendorMe(cookie);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-heading text-primary">
          Multi-event pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Track upcoming bookings across weddings, corporate, festival and community events.
        </p>
      </header>

      {!vendor ? (
        <div className="border border-dashed border-gold/30 rounded-xl px-4 py-12 text-center text-sm text-muted-foreground">
          You need a vendor account to view this page.
        </div>
      ) : (
        <VendorPipelineContent cookie={cookie} vendorId={vendor.id} />
      )}
    </main>
  );
}

async function VendorPipelineContent({
  cookie,
  vendorId,
}: {
  cookie: string;
  vendorId: string;
}) {
  const data = await fetchPipeline(cookie, vendorId);
  if (!data) {
    return (
      <div className="border border-dashed border-gold/30 rounded-xl px-4 py-12 text-center text-sm text-muted-foreground">
        Pipeline data is not available right now. Please try again in a minute.
      </div>
    );
  }
  return <MultiEventPipeline data={data} />;
}
