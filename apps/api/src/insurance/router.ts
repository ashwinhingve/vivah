/**
 * Smart Shaadi — Insurance placement router (Unit 6.3, Tier 3, MOCK ONLY)
 *
 * UNMOUNTED here — Phase 2 mounts this at /api/v1/insurance.
 *
 * Routes:
 *   GET  /insurance/quotes    → HEALTH-led quote list (auth)
 *   POST /insurance/consent   → record explicit consent → referral row (auth)
 *   GET  /insurance/referrals → caller's own insurance referrals (auth)
 */

import { Router, type Response } from 'express';
import { RecordInsuranceConsentSchema, ServiceOfferQuerySchema } from '@smartshaadi/schemas';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  getInsuranceQuotes,
  recordInsuranceConsent,
  listInsuranceReferrals,
  InsuranceError,
} from './service.js';

export const insuranceRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_CONFIGURED: 501,
  INSERT_FAILED: 500,
  VALIDATION_ERROR: 400,
};

function handleInsuranceError(res: Response, e: unknown): void {
  if (e instanceof InsuranceError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── Quotes ────────────────────────────────────────────────────────────────────
insuranceRouter.get('/quotes', authenticate, async (req, res) => {
  const parsed = ServiceOfferQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await getInsuranceQuotes(parsed.data.context ?? 'BOOKING');
    ok(res, result);
  } catch (e) {
    handleInsuranceError(res, e);
  }
});

// ── Consent ───────────────────────────────────────────────────────────────────
insuranceRouter.post('/consent', authenticate, async (req, res) => {
  const parsed = RecordInsuranceConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Consent is required', 400);
    return;
  }
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }
    const referral = await recordInsuranceConsent(profileId, {
      quoteRef:  parsed.data.quoteRef,
      sku:       parsed.data.sku,
      context:   parsed.data.context,
      contextId: parsed.data.contextId ?? null,
    });
    ok(res, { referral }, 201);
  } catch (e) {
    handleInsuranceError(res, e);
  }
});

// ── Own referrals ───────────────────────────────────────────────────────────
insuranceRouter.get('/referrals', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }
    const referrals = await listInsuranceReferrals(profileId);
    ok(res, { referrals });
  } catch (e) {
    handleInsuranceError(res, e);
  }
});
