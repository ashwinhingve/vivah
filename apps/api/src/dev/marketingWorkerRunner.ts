/**
 * Dev-only runner for the Sprint J marketing workers.
 *
 * In USE_MOCK_SERVICES mode the api process deliberately starts no BullMQ
 * workers (no external providers should run pre-launch), which also idles the
 * marketing queues. This runner registers ONLY the three marketing workers —
 * the exact production worker code, against the same local Redis/Postgres —
 * so the campaign lifecycle can be exercised end-to-end in dev.
 *
 *   pnpm exec tsx src/dev/marketingWorkerRunner.ts
 *
 * Ctrl-C to stop. Never used in production (index.ts registers these workers
 * itself when USE_MOCK_SERVICES=false).
 */
import { registerMarketingSweepWorker, scheduleMarketingSweepJob } from '../jobs/marketingSweepJob.js';
import { registerMarketingEventWorker } from '../jobs/marketingEventJob.js';
import { registerMarketingContentGenerateWorker } from '../jobs/marketingContentGenerateJob.js';
import { logger } from '../lib/logger.js';

registerMarketingSweepWorker();
registerMarketingEventWorker();
registerMarketingContentGenerateWorker();
void scheduleMarketingSweepJob();
logger.info('marketing dev worker runner: sweep + event + content-generate workers running');
