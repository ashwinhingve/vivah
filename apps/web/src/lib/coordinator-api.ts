/**
 * Smart Shaadi — Coordinator API client (server-side)
 *
 * Server-only helpers for the /coordinator route tree. No new backend
 * routes — this composes the existing coordinator + vendor-engine
 * endpoints. Use from Server Components and Server Actions only.
 */

import { fetchAuth } from './server-fetch';
import { mutateApi } from './wedding-api';
import type { VendorProfile } from '@smartshaadi/types';

export { fetchManagedWeddings } from './wedding-api';

// Mirrors EVENT_TYPE_VALUES in apps/api/src/routes/vendorEngine.ts — keep in sync.
export const VENDOR_EVENT_TYPES = [
  'WEDDING', 'CORPORATE', 'FESTIVAL', 'COMMUNITY_EVENT', 'COMMUNITY',
  'GOVERNMENT', 'SCHOOL', 'OTHER', 'HALDI', 'MEHNDI', 'SANGEET',
  'ENGAGEMENT', 'RECEPTION',
] as const;
export type VendorEventType = (typeof VENDOR_EVENT_TYPES)[number];

export interface RouteVendorsInput {
  eventType: VendorEventType;
  eventDate: string; // YYYY-MM-DD
  city?: string;
  state?: string;
}

// Wire shape of a single entry in POST /api/v1/vendor-engine/route's
// `vendors` array — see RouteResult in
// apps/api/src/services/vendorEngine/eventRouter.ts. Kept snake_case to
// match the API response exactly; do not rename without checking that file.
interface RouteApiResult {
  vendor_id: string;
  routable: boolean;
  score: number;
  reasons: string[];
  estimated_capacity_pct: number;
}

export interface RoutedVendor {
  vendor: VendorProfile;
  score: number;
  reasons: string[];
  estimatedCapacityPct: number;
}

/**
 * Ranks vendors for a proposed event, then hydrates each routable candidate
 * with its full public profile — the routing endpoint only returns
 * `vendor_id` + score, not display fields.
 */
export async function routeVendors(
  input: RouteVendorsInput,
): Promise<{ ok: true; vendors: RoutedVendor[] } | { ok: false; error: string }> {
  const body = {
    event_type: input.eventType,
    event_date: input.eventDate,
    event_location: {
      city: input.city?.trim() || undefined,
      state: input.state?.trim() || undefined,
    },
  };

  const r = await mutateApi<{ count: number; vendors: RouteApiResult[] }>(
    '/api/v1/vendor-engine/route',
    { method: 'POST', body },
  );
  if (!r.ok || !r.data) {
    return { ok: false, error: r.error ?? 'Vendor routing failed' };
  }

  const hydrated = await Promise.all(
    r.data.vendors
      .filter((v) => v.routable)
      .map(async (v): Promise<RoutedVendor | null> => {
        const vendor = await fetchAuth<VendorProfile>(`/api/v1/vendors/${v.vendor_id}`);
        if (!vendor) return null;
        return {
          vendor,
          score: v.score,
          reasons: v.reasons,
          estimatedCapacityPct: v.estimated_capacity_pct,
        };
      }),
  );

  return { ok: true, vendors: hydrated.filter((h): h is RoutedVendor => h !== null) };
}
