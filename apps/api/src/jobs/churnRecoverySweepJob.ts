/**
 * Smart Shaadi — Churn Recovery Sweep (Unit 7.3)
 *
 * Daily worker that acts on Stay Quotient churn scores:
 *   1. mark previously-sent attempts CONVERTED if the user came back,
 *   2. expire attempts whose window elapsed,
 *   3. score at-risk candidates and open a recovery attempt for each
 *      high/critical user (one open attempt per user, idempotent).
 *
 * Outreach gate: RETENTION_OUTREACH_LIVE. OFF (default) → attempts are stored
 * as DRY_RUN and NO user is messaged (safe pre-launch). Schedule on app boot.
 */
import { Worker } from 'bullmq';
import {
  connection,
  churnRecoverySweepQueue,
  type ChurnRecoverySweepJob,
} from '../infrastructure/redis/queues.js';
import { shouldSendRetentionOutreach } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { selectAtRiskCandidates, scoreCandidates } from '../retention/atRisk.js';
import {
  createRecoveryAttempt,
  markConvertedForActiveUsers,
  expireStaleAttempts,
} from '../retention/service.js';

const QUEUE_NAME = 'churn-recovery-sweep';
const REPEAT_KEY = 'churn-recovery-daily';
const REPEAT_EVERY_MS = 24 * 60 * 60 * 1000;

// Only these bands warrant an outreach attempt.
const ACTIONABLE_BANDS = new Set(['high', 'critical']);

export interface SweepResult {
  converted: number;
  expired:   number;
  scored:    number;
  created:   number;
  sent:      number;
}

/** The sweep body — exported for unit testing without the BullMQ wrapper. */
export async function runChurnRecoverySweep(): Promise<SweepResult> {
  const converted = await markConvertedForActiveUsers();
  const expired   = await expireStaleAttempts();

  const candidates = await selectAtRiskCandidates();
  const scored = await scoreCandidates(candidates);
  const actionable = scored.filter((s) => ACTIONABLE_BANDS.has(s.risk_band));

  const sendOutreach = shouldSendRetentionOutreach;
  let created = 0;
  let sent = 0;
  for (const quotient of actionable) {
    const attempt = await createRecoveryAttempt(quotient, sendOutreach);
    if (attempt) {
      created += 1;
      if (attempt.status === 'SENT') sent += 1;
    }
  }

  const result: SweepResult = { converted, expired, scored: scored.length, created, sent };
  logger.info({ ...result, sendOutreach }, 'churn_recovery_sweep_complete');
  return result;
}

export function registerChurnRecoverySweepWorker(): Worker<ChurnRecoverySweepJob> {
  const worker = new Worker<ChurnRecoverySweepJob>(
    QUEUE_NAME,
    async (job) => {
      const result = await runChurnRecoverySweep();
      logger.info({ ...result, scheduledAt: job.data.scheduledAt }, 'churn_recovery_sweep_job');
      return result;
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'churn_recovery_sweep_failed');
  });

  return worker;
}

/** Schedule the daily repeat job. Idempotent (BullMQ jobId-by-key). */
export async function scheduleChurnRecoverySweepJob(): Promise<void> {
  await churnRecoverySweepQueue.add(
    REPEAT_KEY,
    { scheduledAt: new Date().toISOString() },
    {
      repeat: { every: REPEAT_EVERY_MS },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 50 },
    },
  );
}
