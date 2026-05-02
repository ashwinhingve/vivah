// ─────────────────────────────────────────────────────────────────────────────
// PAN verification adapter — NSDL/Karza/Cashfree.
// SWAP FLAG: set USE_MOCK_SERVICES=false and PAN_PROVIDER + PAN_API_KEY to wire
// real provider. Mock-mode validates the PAN format and stamps a fake refId.
// Never persist the raw PAN — caller stores last-4 only.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID, createHash } from 'node:crypto';
import { PanRegex } from '@smartshaadi/schemas';
import { env } from '../lib/env.js';
import type { PanVerificationResult } from '@smartshaadi/types';

export interface PanVerifyArgs {
  pan:        string;
  nameOnPan:  string;
  dob:        string; // YYYY-MM-DD
}

/** Server-side fingerprint of a PAN — one-way hash, never reversible. */
export function panFingerprint(pan: string): string {
  return createHash('sha256').update(pan.toUpperCase().trim()).digest('hex').slice(0, 32);
}

export async function verifyPan(args: PanVerifyArgs): Promise<PanVerificationResult> {
  const pan = args.pan.toUpperCase().trim();
  if (!PanRegex.test(pan)) return { verified: false, refId: '', panLast4: '' };

  if (env.USE_MOCK_SERVICES) {
    // Mock heuristics: any well-formed PAN passes EXCEPT 'XXXXX' prefix used in tests
    const blocked = pan.startsWith('XXXXX');
    return {
      verified: !blocked,
      refId:    blocked ? '' : `MOCK-PAN-${randomUUID()}`,
      panLast4: pan.slice(-4),
    };
  }

  // TODO: real provider — example NSDL pattern:
  //   POST /pan/verify { pan, name, dob } → { status, refId }
  //   - never log the raw PAN
  //   - never persist `name`/`dob` returned by provider
  //   - rate-limit caller before invoking (caller's responsibility)
  throw new Error('Real PAN provider not yet configured');
}
