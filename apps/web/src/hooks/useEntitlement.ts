'use client';

/**
 * Smart Shaadi — useEntitlement (client hook)
 * apps/web/src/hooks/useEntitlement.ts
 *
 * Fetches the current user's premium tier + per-feature flags + interest quota.
 * One request per page mount; caches in module-level promise across components.
 */

import { useEffect, useState } from 'react';
import type { Entitlements, PremiumTier } from '@smartshaadi/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export interface EntitlementState {
  tier: PremiumTier;
  entitlements: Entitlements;
  quotas: {
    interestsToday: { used: number; limit: number | null; remaining: number | null };
  };
}

let inflight: Promise<EntitlementState | null> | null = null;
let cached: { value: EntitlementState; expiresAt: number } | null = null;
const TTL_MS = 60_000;

async function loadEntitlements(): Promise<EntitlementState | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me/entitlements`, { credentials: 'include' });
      if (!res.ok) return null;
      const json = (await res.json()) as { success: boolean; data: EntitlementState };
      if (!json.success) return null;
      cached = { value: json.data, expiresAt: Date.now() + TTL_MS };
      return json.data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useEntitlement(): {
  state: EntitlementState | null;
  isLoading: boolean;
  isLocked: (feature: keyof Entitlements) => boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<EntitlementState | null>(cached?.value ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!cached);

  useEffect(() => {
    let mounted = true;
    void loadEntitlements().then((v) => {
      if (!mounted) return;
      setState(v);
      setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return {
    state,
    isLoading,
    isLocked: (feature) => {
      if (!state) return true;
      const v = state.entitlements[feature];
      return typeof v === 'boolean' ? !v : false;
    },
    refresh: async () => {
      cached = null;
      const v = await loadEntitlements();
      setState(v);
    },
  };
}
