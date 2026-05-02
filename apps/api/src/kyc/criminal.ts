// ─────────────────────────────────────────────────────────────────────────────
// Criminal record check — eCourts API + state-level FIR records.
// Premium-tier feature: optional, never blocks Aadhaar verification path.
// Returns boolean cleared + provider refId.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env.js';
import type { CriminalCheckResult } from '@smartshaadi/types';

export interface CriminalCheckArgs {
  fullName: string;
  dob:      string | null;
  state:    string | null;
}

export async function checkCriminalRecord(args: CriminalCheckArgs): Promise<CriminalCheckResult> {
  if (env.USE_MOCK_SERVICES) {
    const upper = args.fullName.toUpperCase();
    const blocked = upper.includes('CRIMINAL') || upper.includes('CONVICT');
    return {
      cleared:   !blocked,
      refId:     `MOCK-CRIM-${randomUUID()}`,
      checkedAt: new Date().toISOString(),
    };
  }

  // TODO: integrate eCourts/Karza criminal-record API.
  throw new Error('Real criminal-check provider not yet configured');
}
