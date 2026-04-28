/**
 * Smart Shaadi — Account purge job
 * apps/api/src/jobs/accountPurgeJob.ts
 *
 * Hard-deletes users whose deletionRequestedAt is older than 30 days.
 * Runs once per hour from a process-local interval. Lightweight enough that
 * we don't need a Bull queue — DELETE statement with a date predicate.
 *
 * Cascade delete is handled by FK constraints on session, account, two_factor,
 * auth_events, profiles (et al) — all reference user.id with ON DELETE CASCADE
 * or are joined to profile.userId which itself cascades.
 */

import { lt, and, isNotNull } from 'drizzle-orm';
import { user } from '@smartshaadi/db';
import { db } from '../lib/db.js';

const RUN_INTERVAL_MS = 60 * 60 * 1000; // 1h
const GRACE_DAYS = 30;

export async function purgeExpiredDeletions(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(user)
    .where(and(isNotNull(user.deletionRequestedAt), lt(user.deletionRequestedAt, cutoff)))
    .returning({ id: user.id });
  if (deleted.length > 0) {
    console.info(`[account-purge] purged ${deleted.length} accounts past 30-day grace`);
  }
  return deleted.length;
}

let timer: NodeJS.Timeout | null = null;

export function startAccountPurgeWorker(): void {
  if (timer) return;
  // First run after 60s so startup is not blocked, then every hour.
  setTimeout(() => { void purgeExpiredDeletions().catch((e) => console.warn('[account-purge] failed', e)); }, 60_000);
  timer = setInterval(() => {
    void purgeExpiredDeletions().catch((e) => console.warn('[account-purge] failed', e));
  }, RUN_INTERVAL_MS);
}

export function stopAccountPurgeWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
