/**
 * Smart Shaadi — Order Expiry Job
 *
 * Stock is decremented when an order enters PLACED state, then the customer is
 * sent to Razorpay to complete payment. If they abandon, the stock would sit
 * reserved forever. This worker fires 30 minutes after order creation; if the
 * order is still in PLACED state (never confirmed by webhook), it cancels the
 * order via the existing cancelOrder flow which restores stock transactionally.
 */
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { orders } from '@smartshaadi/db';
import { db } from '../lib/db.js';
import { connection, type OrderExpiryJob } from '../infrastructure/redis/queues.js';
import { cancelOrder } from '../store/order.service.js';

const QUEUE_NAME = 'order-expiry';

export function registerOrderExpiryWorker(): Worker<OrderExpiryJob> {
  const worker = new Worker<OrderExpiryJob>(
    QUEUE_NAME,
    async (job) => {
      const { orderId } = job.data;

      const [order] = await db
        .select({ status: orders.status, customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) {
        console.warn(`[orderExpiryJob] order ${orderId} not found — skipping`);
        return;
      }

      if (order.status !== 'PLACED') {
        // Already confirmed, cancelled, shipped, etc. — nothing to do.
        return;
      }

      try {
        await cancelOrder(order.customerId, orderId);
        console.info(`[orderExpiryJob] expired unpaid order ${orderId} — stock restored`);
      } catch (e) {
        console.error(`[orderExpiryJob] failed to expire order ${orderId}:`, e);
        throw e;
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[orderExpiryJob] job ${job?.id} failed:`, err);
  });

  return worker;
}
