/**
 * Smart Shaadi — lastActiveAt heartbeat
 * apps/api/src/auth/lastActive.ts
 *
 * Fire-and-forget update of profiles.last_active_at. Called from `authenticate`
 * once per authenticated request. Throttled in-process (60s per userId) to
 * avoid DB churn on chatty clients (chat polling, /me/entitlements, etc).
 */

import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles } from '@smartshaadi/db';

const THROTTLE_MS = 60_000;
const lastWriteByUser = new Map<string, number>();

export function pingLastActive(userId: string): void {
  const now = Date.now();
  const last = lastWriteByUser.get(userId) ?? 0;
  if (now - last < THROTTLE_MS) return;
  lastWriteByUser.set(userId, now);
  try {
    const result = db.update(profiles).set({ lastActiveAt: new Date() }).where(eq(profiles.userId, userId));
    void Promise.resolve(result).catch((error: unknown) => {
      console.warn('[lastActive] update failed', error);
    });
  } catch (error) {
    console.warn('[lastActive] update threw synchronously', error);
  }
}
