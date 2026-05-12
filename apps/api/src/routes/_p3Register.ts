/**
 * P3 router + worker registration helper.
 *
 * Isolates all Phase 3 + Tier 3 router wiring behind two functions so
 * apps/api/src/index.ts only changes by three lines (import + mount call
 * + worker call). Reduces merge-conflict surface with parallel sessions
 * that also edit index.ts.
 */
import type { Express } from 'express';
import type { Worker } from 'bullmq';

import { assistantRouter } from './assistant.js';
import { vendorEngineRouter } from './vendorEngine.js';
import { referralRouter } from './referral.js';
import { vendorLeadsRouter, vendorLeadsAdminRouter } from './vendorLeads.js';

import {
  registerVendorAvailabilityRefreshWorker,
  scheduleVendorAvailabilityRefreshJob,
} from '../jobs/vendorAvailabilityRefreshJob.js';

export function registerP3Routes(app: Express): void {
  app.use('/api/v1/assistant', assistantRouter);
  app.use('/api/v1/vendor-engine', vendorEngineRouter);
  app.use('/api/v1/referral', referralRouter);
  app.use('/api/v1/vendor-leads', vendorLeadsRouter);
  app.use('/api/v1/admin', vendorLeadsAdminRouter);
}

export function registerP3Workers(workers: Array<{ close(): Promise<void> }>): void {
  const worker: Worker = registerVendorAvailabilityRefreshWorker();
  workers.push(worker);
  void scheduleVendorAvailabilityRefreshJob();
}
