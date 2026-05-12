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
import { assistantRouter } from './assistant.js';

export function registerP3Routes(app: Express): void {
  app.use('/api/v1/assistant', assistantRouter);
}

export function registerP3Workers(_workers: Array<{ close(): Promise<void> }>): void {
  // No P3 workers yet — vendor utilization refresh ships in the next P3 module.
}
