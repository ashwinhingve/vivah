/**
 * Smart Shaadi — Payment Links Page (vendor/coordinator)
 * Hybrid: Server Component for listing + client component for create form.
 */
import { cookies } from 'next/headers';
import type { PaymentLinkRecord } from '@smartshaadi/types';
import { PaymentLinksClient } from './PaymentLinksClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchLinks(): Promise<PaymentLinkRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/links/mine?limit=50`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    // API envelope: { success, data: { items: [...] }, error, meta }
    const json = (await res.json()) as {
      success: boolean;
      data: { items: PaymentLinkRecord[] } | null;
    };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

export default async function PaymentLinksPage() {
  const links = await fetchLinks();
  return <PaymentLinksClient initialLinks={links} />;
}
