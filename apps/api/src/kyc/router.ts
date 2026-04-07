import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import { KycInitiateSchema, KycPhotoSchema, AdminReviewSchema } from '@vivah/schemas';
import { KycErrorCode } from '@vivah/types';
import * as service from './service.js';

export const kycRouter:      ExpressRouter = Router();
export const adminKycRouter: ExpressRouter = Router();

// ── User endpoints ────────────────────────────────────────────────────────────

// POST /api/v1/kyc/initiate  (also mounted at /api/v1/auth/kyc/initiate per spec)
kycRouter.post('/initiate', authenticate, async (req, res) => {
  const parsed = KycInitiateSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const result = await service.initiateAadhaarVerification(req.user!.sub, parsed.data.redirectUri);
    ok(res, result);
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND)    { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED) { err(res, code, 'Already verified', 409); return; }
    if (code === KycErrorCode.KYC_REJECTED)         { err(res, code, 'KYC was rejected', 403); return; }
    if (code === KycErrorCode.KYC_IN_REVIEW)        { err(res, code, 'KYC is under review', 409); return; }
    console.error('[kyc/initiate]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to initiate KYC', 500);
  }
});

// GET /api/v1/kyc/callback  — DigiLocker OAuth callback
kycRouter.get('/callback', authenticate, async (req, res) => {
  const digiCode = req.query['code'];
  if (typeof digiCode !== 'string' || !digiCode) {
    err(res, 'VALIDATION_ERROR', 'Missing DigiLocker code', 400);
    return;
  }
  const ipAddress = (req.ip ?? '').replace('::ffff:', '');
  const device    = req.headers['user-agent'] ?? 'unknown';
  try {
    const result = await service.completeAadhaarVerification(req.user!.sub, digiCode, ipAddress, device);
    ok(res, {
      message:       'Aadhaar verification submitted for review.',
      duplicateFlag: result.duplicateFlag,
    });
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND)           { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED)        { err(res, code, 'Already verified', 409); return; }
    if (code === KycErrorCode.KYC_REJECTED)                { err(res, code, 'KYC was rejected', 403); return; }
    if (code === KycErrorCode.KYC_IN_REVIEW)               { err(res, code, 'KYC is under review', 409); return; }
    if (code === KycErrorCode.AADHAAR_VERIFICATION_FAILED) { err(res, code, 'Aadhaar verification failed', 422); return; }
    console.error('[kyc/callback]', e);
    err(res, 'INTERNAL_ERROR', 'Aadhaar verification failed', 500);
  }
});

// POST /api/v1/kyc/photo
kycRouter.post('/photo', authenticate, async (req, res) => {
  const parsed = KycPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    const result = await service.analyzeProfilePhoto(req.user!.sub, parsed.data.r2Key);
    ok(res, { status: result.status, photoAnalysis: result.photoAnalysis });
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND)    { err(res, code, 'Profile not found', 404); return; }
    if (code === KycErrorCode.KYC_ALREADY_VERIFIED) { err(res, code, 'Already verified', 409); return; }
    if (code === KycErrorCode.KYC_REJECTED)         { err(res, code, 'KYC was rejected', 403); return; }
    console.error('[kyc/photo]', e);
    err(res, 'INTERNAL_ERROR', 'Photo analysis failed', 500);
  }
});

// GET /api/v1/kyc/status
kycRouter.get('/status', authenticate, async (req, res) => {
  try {
    const result = await service.getKycStatus(req.user!.sub);
    ok(res, result);
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    console.error('[kyc/status]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch KYC status', 500);
  }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

// GET /api/v1/admin/kyc/pending
adminKycRouter.get('/pending', authenticate, authorize(['ADMIN']), async (_req, res) => {
  try {
    const pendingProfiles = await service.getPendingKycProfiles();
    ok(res, { profiles: pendingProfiles, total: pendingProfiles.length });
  } catch (e) {
    console.error('[kyc/pending]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch pending KYC queue', 500);
  }
});

// PUT /api/v1/admin/kyc/:profileId/approve
adminKycRouter.put('/:profileId/approve', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = AdminReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    await service.approveKyc(req.params['profileId']!, req.user!.sub, parsed.data.note);
    ok(res, { message: 'KYC approved' });
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    console.error('[kyc/approve]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to approve KYC', 500);
  }
});

// PUT /api/v1/admin/kyc/:profileId/reject
adminKycRouter.put('/:profileId/reject', authenticate, authorize(['ADMIN']), async (req, res) => {
  const parsed = AdminReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    return;
  }
  try {
    await service.rejectKyc(req.params['profileId']!, req.user!.sub, parsed.data.note);
    ok(res, { message: 'KYC rejected' });
  } catch (e) {
    const code = e instanceof Error ? e.name : '';
    if (code === KycErrorCode.PROFILE_NOT_FOUND) { err(res, code, 'Profile not found', 404); return; }
    console.error('[kyc/reject]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to reject KYC', 500);
  }
});
