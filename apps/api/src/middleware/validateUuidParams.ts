import type { Router } from 'express';
import { err } from '../lib/response.js';

/**
 * Canonical UUID matcher (v1–v5, case-insensitive). Mirrors the inline regex
 * already used in `profiles/router.ts` and `kyc/router.ts` so behaviour is
 * consistent across the codebase.
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registers a `router.param()` guard for each named path param that maps to a
 * Postgres `uuid` column. The guard fires *before* the route handler runs, so a
 * malformed segment is rejected with a clean `400 INVALID_ID` instead of
 * reaching Drizzle and triggering a Postgres `22P02` (which the per-router
 * `handleError` helpers surface as a `500` that leaks the raw DB message).
 *
 * `router.param()` is the correct mechanism here: it fires exactly when the
 * named param is present in a matched route, with the resolved value. A plain
 * `router.use()` middleware cannot see route-level `req.params`.
 *
 * Only register params that are genuinely Postgres uuids — never Mongo ids,
 * slugs, integer indexes, or opaque tokens.
 */
export function registerUuidParams(router: Router, ...names: string[]): void {
  for (const name of names) {
    router.param(name, (_req, res, next, value) => {
      if (typeof value === 'string' && !UUID_RE.test(value)) {
        err(res, 'INVALID_ID', 'Malformed id in request', 400);
        return; // do not call next() — the handler (and DB query) never runs
      }
      next();
    });
  }
}
