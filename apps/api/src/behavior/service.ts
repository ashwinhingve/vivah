import { shouldUseMockMongo } from '../lib/env.js';
import { BehaviorEvent } from '../infrastructure/mongo/models/BehaviorEvent.js';
import { behaviorEventQueue, type BehaviorEventJob } from '../infrastructure/redis/queues.js';
import { logger } from '../lib/logger.js';

const mockBehaviorBuffer: BehaviorEventJob[] = [];

export function _readMockBehaviorBuffer(): readonly BehaviorEventJob[] {
  return mockBehaviorBuffer;
}

export function _clearMockBehaviorBuffer(): void {
  mockBehaviorBuffer.length = 0;
}

/**
 * Producer — enqueues a single behavior event for async ingestion.
 * Never throws; failures are logged. Middleware MUST stay fast.
 */
export async function enqueueBehaviorEvent(job: BehaviorEventJob): Promise<void> {
  try {
    await behaviorEventQueue.add('capture', job, {
      removeOnComplete: { count: 5000 },
      removeOnFail:     { count: 200 },
    });
  } catch (err) {
    logger.warn({ err }, '[behavior] enqueue failed');
  }
}

/**
 * Consumer-side persistence — invoked by the worker per dequeued job.
 * Routes through mockStorePush when USE_MOCK_SERVICES is set to avoid
 * the 10s Mongoose buffering crash documented in CLAUDE.md rule 11.
 */
export async function persistBehaviorEvent(job: BehaviorEventJob): Promise<void> {
  if (shouldUseMockMongo) {
    mockBehaviorBuffer.push(job);
    if (mockBehaviorBuffer.length > 5000) mockBehaviorBuffer.splice(0, 1000);
    return;
  }
  await BehaviorEvent.create({
    userId:     job.userId,
    route:      job.route,
    method:     job.method,
    statusCode: job.statusCode,
    durationMs: job.durationMs,
    ts:         new Date(job.ts),
    meta:       job.meta,
  });
}
