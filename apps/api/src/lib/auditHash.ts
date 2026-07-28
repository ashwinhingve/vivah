/**
 * Shared audit-chain content hash (P2-1, P2-6).
 *
 * Consolidates three byte-identical copies (payments/service.ts,
 * admin/platformSettings.router.ts, jobs/auditChainVerifierJob.ts) into one — if any
 * copy had drifted, the chain would have silently failed to verify.
 *
 * It also fixes the jsonb round-trip defect: the previous `JSON.stringify(payload)`
 * hashed the JS object's insertion key order at WRITE time, but the verifier
 * re-stringified the SAME payload read back from a Postgres `jsonb` column, which does
 * not preserve key order. A legitimately-written row whose keys weren't already in
 * jsonb's canonical order therefore hashed differently on verify and raised a false
 * `CHAIN TAMPERED` alert. A canonical (recursively key-sorted) serialization is
 * order-independent, so write-time and verify-time hashes agree regardless of jsonb's
 * internal key ordering.
 */
import { createHash } from 'node:crypto';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function auditContentHash(payload: unknown, prevHash: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)) + (prevHash ?? ''))
    .digest('hex');
}
