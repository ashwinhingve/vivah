/**
 * Smart Shaadi — Admin Promo Manager
 * Hybrid: Server Component lists promos + client for create and toggle.
 */
import { cookies } from 'next/headers';
import type { PromoCodeRecord } from '@smartshaadi/types';
import { AdminPromosClient } from './AdminPromosClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function fetchPromos(): Promise<PromoCodeRecord[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/api/v1/payments/promos/active?includeInactive=true&limit=100`, {
      headers: { Cookie: `better-auth.session_token=${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { success: boolean; data: PromoCodeRecord[] | null };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function AdminPromosPage() {
  const promos = await fetchPromos();
  return <AdminPromosClient initialPromos={promos} />;
}
