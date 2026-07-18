/**
 * Smart Shaadi — Marketing Event Hooks (Unit 6.4, Sprint J)
 *
 * Fire-and-forget emission of product events that trigger EVENT-type campaigns.
 * Never awaited by callers; failures are logged but never thrown.
 */

import { marketingEventQueue } from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';
import type { MarketingEventHookKey } from '@smartshaadi/types';

/**
 * Emit a marketing event for event-triggered campaign dispatch.
 * Fire-and-forget: never awaits, never throws.
 *
 * Hook points:
 * - user_registered: after Better Auth user.create (auth/config.ts)
 * - kyc_approved: after admin KYC approval (kyc/service.ts)
 * - booking_created: after booking insert success (bookings/service.ts)
 */
export function emitMarketingEvent(
  eventType: MarketingEventHookKey,
  userId: string,
): void {
  // The whole body sits inside try/catch, not just the promise chain: in
  // mock-mode tests (and any environment where the queues module is partially
  // mocked or Redis is absent) the `.add` ACCESS itself can throw
  // synchronously, and a hook that can crash its host code path — booking
  // creation, registration — is worse than a lost marketing event.
  try {
    const jobId = `mkt-${eventType}-${userId}`;
    void marketingEventQueue
      .add(eventType, {
        eventType,
        userId,
        occurredAt: new Date().toISOString(),
      }, {
        jobId,
        removeOnComplete: true,
        removeOnFail: { count: 10 },
      })
      .catch((err: unknown) => {
        logger.warn({ err, eventType, userId }, 'marketing_event_enqueue_failed');
      });
  } catch (err: unknown) {
    logger.warn({ err, eventType, userId }, 'marketing_event_enqueue_failed');
  }
}
