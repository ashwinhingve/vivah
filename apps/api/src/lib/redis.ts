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
