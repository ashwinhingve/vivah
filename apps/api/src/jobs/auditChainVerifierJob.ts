/**
 * Smart Shaadi — Audit Chain Verifier Job
 *
 * Background sweep that re-computes the chained-hash for audit_logs and
 * detects tampering. Runs daily via Bull queue with deterministic jobId.
 *
 * For each entityId in audit_logs:
 *   1. Fetch all rows ordered by createdAt ASC
 *   2. Re-compute contentHash for each row using its payload + the previous
 *      row's contentHash
 *   3. If a re-computed hash diverges from the stored hash, raise a Sentry
 *      alert with entity + offending row id
 *
 * The audit_logs table is INSERT-only by convention. Tampering would require
 * direct DB write access and would invalidate the chain from the tampered
 * row onwards — this job catches that.
 */
import { createHash } from 'node:crypto';
import { Worker, Queue } from 'bullmq';
import { eq, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { connection, DEFAULT_JOB_OPTS } from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import * as Sentry from '@sentry/node';

const QUEUE_NAME = 'audit-chain-verifier';

export interface AuditChainVerifierJob {
  scheduledAt: string;
}

export const auditChainVerifierQueue = new Queue<AuditChainVerifierJob>(QUEUE_NAME, { connection });

function computeHash(payload: unknown, prevHash: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(payload) + (prevHash ?? ''))
    .digest('hex');
}

export async function verifyEntityChain(entityId: string): Promise<{
  ok: boolean;
  entriesChecked: number;
  firstBadRowId: string | null;
}> {
  const rows = await db
    .select({
      id: schema.auditLogs.id,
      payload: schema.auditLogs.payload,
      contentHash: schema.auditLogs.contentHash,
      prevHash: schema.auditLogs.prevHash,
    })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.entityId, entityId))
    .orderBy(asc(schema.auditLogs.createdAt));

  let prev: string | null = null;
  for (const row of rows) {
    const expected = computeHash(row.payload, prev);
    if (expected !== row.contentHash) {
      return { ok: false, entriesChecked: rows.length, firstBadRowId: row.id };
    }
    prev = row.contentHash;
  }
  return { ok: true, entriesChecked: rows.length, firstBadRowId: null };
}

export function registerAuditChainVerifierWorker(): Worker<AuditChainVerifierJob> {
  const worker = new Worker<AuditChainVerifierJob>(
    QUEUE_NAME,
    async (_job) => {
      // Fetch distinct entityIds from audit_logs.
      // For very large logs, paginate by entityType.
      const entityIds = await db
        .selectDistinct({ entityId: schema.auditLogs.entityId })
        .from(schema.auditLogs);

      logger.info(
        { entityCount: entityIds.length },
        '[auditChainVerifier] starting sweep',
      );

      let bad = 0;
      for (const { entityId } of entityIds) {
        const result = await verifyEntityChain(entityId);
        if (!result.ok) {
          bad += 1;
          logger.error(
            { entityId, firstBadRowId: result.firstBadRowId, entriesChecked: result.entriesChecked },
            '[auditChainVerifier] CHAIN TAMPERED',
          );
          Sentry.captureMessage(
            `Audit chain tampering detected: entity ${entityId} row ${result.firstBadRowId}`,
            'fatal',
          );
        }
      }

      logger.info(
        { entityCount: entityIds.length, badCount: bad },
        '[auditChainVerifier] sweep complete',
      );
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[auditChainVerifier] job failed');
  });

  return worker;
}

/**
 * Schedule daily sweep with deterministic jobId — repeats per day, idempotent.
 */
export async function scheduleAuditChainVerifierJob(): Promise<void> {
  await auditChainVerifierQueue.add(
    'daily-sweep',
    { scheduledAt: new Date().toISOString() },
    {
      ...DEFAULT_JOB_OPTS,
      repeat: { pattern: '0 4 * * *' }, // 04:00 UTC daily — quiet hours
      jobId: 'audit-chain-verifier-daily',
    },
  );
}
