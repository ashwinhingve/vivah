/**
 * Smart Shaadi — Server-side entitlements helper
 * apps/web/src/lib/entitlements-server.ts
 */

import { fetchAuth } from './server-fetch';
import type { Entitlements, PremiumTier } from '@smartshaadi/types';

export interface ServerEntitlements {
  tier: PremiumTier;
  entitlements: Entitlements;
  quotas: { interestsToday: { used: number; limit: number | null; remaining: number | null } };
}

export async function getEntitlementsForCurrentUser(): Promise<ServerEntitlements | null> {
  return fetchAuth<ServerEntitlements>('/api/v1/users/me/entitlements');
}
