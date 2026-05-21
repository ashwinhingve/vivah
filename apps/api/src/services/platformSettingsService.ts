/**
 * Platform settings service — admin-controlled global feature toggles.
 *
 * Each setting is a (key, jsonb value) row in platform_settings. Toggles are
 * read hot during request handling (e.g. matchmaking gender filter), so values
 * are cached in-memory with a short TTL. Cache busts on setPlatformSetting so
 * the admin UI sees its own write immediately.
 *
 * Seeded keys (migration 0025): lgbtq_matching_enabled (boolean, default false).
 */

import { eq } from 'drizzle-orm';
import { platformSettings } from '@smartshaadi/db';
import { db } from '../lib/db.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getPlatformSetting(key: string): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const rows = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);

  const value = rows[0]?.value ?? null;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function listPlatformSettings(): Promise<Array<{ key: string; value: unknown; updatedAt: Date; updatedBy: string | null }>> {
  const rows = await db.select().from(platformSettings);
  return rows.map((r) => ({
    key: r.key,
    value: r.value as unknown,
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy ?? null,
  }));
}

export async function setPlatformSetting(
  key: string,
  value: unknown,
  adminUserId: string,
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key, value: value as never, updatedBy: adminUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: value as never, updatedBy: adminUserId, updatedAt: new Date() },
    });
  cache.delete(key);
}

export async function isLGBTQMatchingEnabled(): Promise<boolean> {
  const v = await getPlatformSetting('lgbtq_matching_enabled');
  return v === true;
}

/** Test-only: clears the in-memory cache so a fresh read hits the DB. */
export function __clearPlatformSettingsCache(): void {
  cache.clear();
}
