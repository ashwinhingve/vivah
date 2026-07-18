/**
 * Smart Shaadi — Lending placement router (Unit 6.2, Tier 3, MOCK ONLY)
 *
 * UNMOUNTED here — Phase 2 mounts this at /api/v1/lending.
 *
 * Routes:
 *   GET  /lending/offers    → neutral multi-offer list (auth)
 *   POST /lending/consent   → record explicit consent → referral row (auth)
 *   GET  /lending/referrals → caller's own lending referrals (auth)
 */

import { Router, type Response } from 'express';
import { RecordLendingConsentSchema, ServiceOfferQuerySchema } from '@smartshaadi/schemas';
import { authenticate } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { resolveProfileId } from '../lib/profile.js';
import {
  getLoanOffers,
  recordLendingConsent,
  listLendingReferrals,
  LendingError,
} from './service.js';

export const lendingRouter = Router();

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_CONFIGURED: 501,
  INSERT_FAILED: 500,
  VALIDATION_ERROR: 400,
};

function handleLendingError(res: Response, e: unknown): void {
  if (e instanceof LendingError) {
    err(res, e.code, e.message, STATUS_BY_CODE[e.code] ?? 400);
    return;
  }
  const msg = e instanceof Error ? e.message : 'Unexpected error';
  err(res, 'INTERNAL_ERROR', msg, 500);
}

// ── Offers ────────────────────────────────────────────────────────────────────
lendingRouter.get('/offers', authenticate, async (req, res) => {
  const parsed = ServiceOfferQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await getLoanOffers(parsed.data.context ?? 'BOOKING');
    ok(res, result);
  } catch (e) {
    handleLendingError(res, e);
  }
});

// ── Consent ───────────────────────────────────────────────────────────────────
lendingRouter.post('/consent', authenticate, async (req, res) => {
  const parsed = RecordLendingConsentSchema.safeParse(req.body);
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
    const referral = await recordLendingConsent(profileId, {
      offerRef:  parsed.data.offerRef,
      context:   parsed.data.context,
      contextId: parsed.data.contextId ?? null,
    });
    ok(res, { referral }, 201);
  } catch (e) {
    handleLendingError(res, e);
  }
});

// ── Own referrals ───────────────────────────────────────────────────────────
lendingRouter.get('/referrals', authenticate, async (req, res) => {
  try {
    const profileId = await resolveProfileId(req.user!.id);
    if (!profileId) {
      err(res, 'NOT_FOUND', 'User profile not found', 404);
      return;
    }
    const referrals = await listLendingReferrals(profileId);
    ok(res, { referrals });
  } catch (e) {
    handleLendingError(res, e);
  }
});
