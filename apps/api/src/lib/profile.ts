import { eq } from 'drizzle-orm';
import { profiles } from '@smartshaadi/db';
import { db } from './db.js';

const cache = new Map<string, { profileId: string; expiresAt: number }>();
const TTL_MS = 60_000;

/**
 * Resolve a Better Auth userId to its profiles.id UUID.
 * Cached in-process for 60s to avoid repeated single-row lookups on hot paths
 * (match feed, chat sockets, every authenticated mutation touching profile-
 * keyed tables). Returns null if the user has no profile row yet.
 */
export async function resolveProfileId(userId: string): Promise<string | null> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.profileId;

  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!row) return null;
  cache.set(userId, { profileId: row.id, expiresAt: Date.now() + TTL_MS });
  return row.id;
}

export function invalidateProfileIdCache(userId: string): void {
  cache.delete(userId);
}
