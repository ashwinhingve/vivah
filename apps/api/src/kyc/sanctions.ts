// ─────────────────────────────────────────────────────────────────────────────
// Sanctions / PEP screening — World-Check, OFAC, UN, INTERPOL Red Notice.
// On hit: block KYC, lock profile, alert SUPPORT role for review.
// Mock-mode: blocks names containing 'BLOCKED' (test fixture).
// ─────────────────────────────────────────────────────────────────────────────
import { env } from '../lib/env.js';
import type { SanctionsCheckResult } from '@smartshaadi/types';

export interface SanctionsArgs {
  fullName: string;
  dob:      string | null;
  country:  string;
}

const LISTS = ['OFAC', 'UN', 'INTERPOL', 'RBI_DEFAULTERS'];

export async function checkSanctions(args: SanctionsArgs): Promise<SanctionsCheckResult> {
  if (env.USE_MOCK_SERVICES) {
    const upper = args.fullName.toUpperCase();
    const hit = upper.includes('BLOCKED') || upper.includes('SANCTIONED');
    return {
      hit,
      listsChecked: LISTS,
      matchScore:   hit ? 95 : 0,
      checkedAt:    new Date().toISOString(),
    };
  }

  // TODO: vendor (e.g. Refinitiv World-Check) — fuzzy-match name + DOB across LISTS,
  //   any matchScore >= 90 = hard block, 70-89 = manual review escalation.
  throw new Error('Real sanctions provider not yet configured');
}
