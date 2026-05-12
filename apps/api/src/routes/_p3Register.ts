/**
 * P3 router + worker registration helper.
 *
 * Isolates all Phase 3 (P3 Lite — Matrimony AI Assistant + Vendor Engine
 * foundation) wiring behind two functions so apps/api/src/index.ts only
 * changes by three lines (import + mount call + worker call). Reduces
 * merge-conflict surface with the parallel P2 session that also edits
 * index.ts.
 */
import type { Express } from 'express';
import type { Worker } from 'bullmq';
import { assistantRouter } from './assistant.js';
import { vendorEngineRouter } from './vendorEngine.js';
import { referralRouter } from './referral.js';
import {
  registerVendorAvailabilityRefreshWorker,
  scheduleVendorAvailabilityRefreshJob,
} from '../jobs/vendorAvailabilityRefreshJob.js';

export function registerP3Routes(app: Express): void {
  app.use('/api/v1/assistant', assistantRouter);
  app.use('/api/v1/vendor-engine', vendorEngineRouter);
  app.use('/api/v1/referral', referralRouter);
}

export function registerP3Workers(workers: Array<{ close(): Promise<void> }>): void {
  const worker: Worker = registerVendorAvailabilityRefreshWorker();
  workers.push(worker);
  void scheduleVendorAvailabilityRefreshJob();
}
