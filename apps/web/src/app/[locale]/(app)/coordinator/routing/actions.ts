'use server';

import { routeVendors } from '@/lib/coordinator-api';
import type { RouteVendorsInput, RoutedVendor } from '@/lib/coordinator-api';

/**
 * Server Action wrapper around the shared `routeVendors` composition helper
 * (apps/web/src/lib/coordinator-api.ts) — lets the client form call it
 * directly without a dedicated API route.
 */
export async function submitVendorRouting(
  input: RouteVendorsInput,
): Promise<{ ok: true; vendors: RoutedVendor[] } | { ok: false; error: string }> {
  return routeVendors(input);
}
