/**
 * Smart Shaadi — Escrow Release Job
 *
 * BullMQ Worker for the 'queue:escrow-release' queue.
 * Wiring: Phase 2 single agent will call registerEscrowReleaseWorker() from the
 *         main entry point (apps/api/src/index.ts) after the express app is set up.
 *
 * Job contract (enqueued by bookings teammate):
 *   { escrowId: string, bookingId: string, vendorId: string, amount: number }
 *
 * Invariants:
 *  - If booking.status === 'DISPUTED', do NOT release — log warning and return.
 *  - audit_logs are APPEND-ONLY — this job only INSERTs, never updates audit_logs.
 *  - Escrow released = exact job.amount (the 50% held amount).
 */
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor } from '../lib/razorpay.js';
import { appendAuditLog } from '../payments/service.js';

const QUEUE_NAME = 'queue:escrow-release';

/** Shape of each escrow release job's data. */
export interface EscrowReleaseJobData {
  escrowId:  string | null;
  bookingId: string;
  vendorId:  string;
  amount:    number;
}

/**
 * registerEscrowReleaseWorker — call this once at app startup.
 * Phase 2 single agent will import and invoke this from apps/api/src/index.ts.
 *
 * @returns The BullMQ Worker instance (call worker.close() on graceful shutdown).
 */
export function registerEscrowReleaseWorker(): Worker<EscrowReleaseJobData> {
  const connection = {
    url:                  env.REDIS_URL,
    enableOfflineQueue:   false,
    maxRetriesPerRequest: null as unknown as number,
  };

  const worker = new Worker<EscrowReleaseJobData>(
    QUEUE_NAME,
    async (job) => {
      const { escrowId, bookingId, vendorId, amount } = job.data;

      // 1. Fetch booking — if DISPUTED, bail out without releasing
      const [booking] = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId));

      if (!booking) {
        console.warn(`[escrowReleaseJob] booking ${bookingId} not found — skipping`);
        return;
      }

      if (booking.status === 'DISPUTED') {
        console.warn(
          `[escrowReleaseJob] booking ${bookingId} is DISPUTED — escrow release blocked`,
        );
        return;
      }

      // 2. Transfer funds to vendor via Razorpay (mock-safe — guarded in razorpay.ts)
      await transferToVendor(vendorId, amount);

      // 3. Update escrowAccounts: status → RELEASED, releasedAmount = amount
      if (escrowId) {
        await db
          .update(schema.escrowAccounts)
          .set({
            status:      'RELEASED',
            released:    String(amount),
            releasedAt:  new Date(),
          })
          .where(eq(schema.escrowAccounts.id, escrowId));
      }

      // 4. Append audit log — NEVER update, always insert new row
      await appendAuditLog({
        eventType:  'ESCROW_RELEASED',
        entityType: 'escrow',
        entityId:   escrowId ?? bookingId,  // fallback to bookingId when no escrow record
        actorId:    'system',
        payload:    { escrowId, bookingId, vendorId, amount },
      });

      console.info(
        `[escrowReleaseJob] released ₹${amount} for booking ${bookingId} → vendor ${vendorId}`,
      );
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[escrowReleaseJob] job ${job?.id} failed:`, err);
  });

  return worker;
}
