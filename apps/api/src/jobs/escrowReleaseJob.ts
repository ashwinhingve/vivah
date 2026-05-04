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
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import * as schema from '@smartshaadi/db';
import { transferToVendor } from '../lib/razorpay.js';
import { rupeesToPaise } from '../lib/money.js';
import { appendAuditLog } from '../payments/service.js';
import { connection } from '../infrastructure/redis/queues.js';

const QUEUE_NAME = 'escrow-release';

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

      // 2. CAS guard — flip HELD → RELEASE_PENDING before any external call.
      //    BullMQ retries on transient Razorpay failure could otherwise re-invoke
      //    transferToVendor and double-pay the vendor. By moving status to
      //    RELEASE_PENDING first, a re-run sees status != HELD and aborts here.
      if (escrowId) {
        const claimed = await db
          .update(schema.escrowAccounts)
          .set({ status: 'RELEASE_PENDING' })
          .where(
            and(
              eq(schema.escrowAccounts.id, escrowId),
              eq(schema.escrowAccounts.status, 'HELD'),
            ),
          )
          .returning({ id: schema.escrowAccounts.id });

        if (claimed.length === 0) {
          console.warn(
            `[escrowReleaseJob] escrow ${escrowId} not in HELD state — skipping (already in progress or released)`,
          );
          return;
        }
      }

      // 3. Transfer funds to vendor via Razorpay (mock-safe — guarded in razorpay.ts)
      // amount is rupees; Razorpay requires paise.
      await transferToVendor(vendorId, rupeesToPaise(amount));

      // 4. Update escrowAccounts: RELEASE_PENDING → RELEASED, releasedAmount = amount
      if (escrowId) {
        await db
          .update(schema.escrowAccounts)
          .set({
            status:      'RELEASED',
            released:    String(amount),
            releasedAt:  new Date(),
          })
          .where(
            and(
              eq(schema.escrowAccounts.id, escrowId),
              eq(schema.escrowAccounts.status, 'RELEASE_PENDING'),
            ),
          );
      }

      // 5. Append audit log — NEVER update, always insert new row
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
