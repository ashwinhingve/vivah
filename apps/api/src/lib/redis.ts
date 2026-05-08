import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Railway private hostnames (e.g. redis.railway.internal) resolve AAAA-only.
  // ioredis defaults to family:4 → DNS returns nothing → ETIMEDOUT loop.
  // family:0 lets the kernel pick whichever address family DNS returns.
  family: 0,
});

redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message);
});

/**
 * Targeted invalidation of one user's pre-computed match feed cache.
 * Called from profile/preferences/KYC save paths so the next /matchmaking/feed
 * call rebuilds with the user's latest data instead of returning a 24h stale entry.
 */
export async function bustOwnFeedCache(userId: string): Promise<void> {
  try {
    await redis.del(`match_feed:${userId}`);
  } catch (e) {
    console.error('[redis] bustOwnFeedCache failed:', e);
  }
}
