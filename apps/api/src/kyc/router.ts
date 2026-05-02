import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { ok, err } from '../lib/response.js';
import {
  KycInitiateSchema, KycPhotoSchema, AdminReviewSchema,
  KycPanSchema, KycLivenessSchema, KycFaceMatchSchema, KycBankSchema,
  KycDocumentSchema, KycAppealSchema, KycReverifySchema,
  AdminInfoRequestSchema, AdminAppealResolveSchema,
} from '@smartshaadi/schemas';
import { KycErrorCode } from '@smartshaadi/types';
import * as service from './service.js';

export const kycRouter:      ExpressRouter = Router();
export const adminKycRouter: ExpressRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reqMeta(req: { ip?: string | undefined; headers: Record<string, string | string[] | undefined> }) {
  return {
    ip: (req.ip ?? '').replace('::ffff:', ''),
    ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown',
  };
}

function mapKycError(e: unknown, res: Parameters<typeof ok>[0]): boolean {
  const code = e instanceof Error ? e.name : '';
  const map: Record<string, [string, number]> = {
    [KycErrorCode.PROFILE_NOT_FOUND]:           ['Profile not found', 404],
    [KycErrorCode.KYC_ALREADY_VERIFIED]:        ['Already verified', 409],
    [KycErrorCode.KYC_REJECTED]:                ['KYC was rejected', 403],
    [KycErrorCode.KYC_IN_REVIEW]:               ['KYC is under review', 409],
    [KycErrorCode.KYC_LOCKED]:                  ['KYC locked due to too many attempts', 423],
    [KycErrorCode.KYC_EXPIRED]:                 ['KYC verification has expired', 410],
    [KycErrorCode.AADHAAR_VERIFICATION_FAILED]: ['Aadhaar verification failed', 422],
    [KycErrorCode.PAN_VERIFICATION_FAILED]:     ['PAN verification failed', 422],
    [KycErrorCode.BANK_VERIFICATION_FAILED]:    ['Bank verification failed', 422],
    [KycErrorCode.LIVENESS_FAILED]:             ['Liveness check failed', 422],
    [KycErrorCode.FACE_MATCH_FAILED]:           ['Face match failed', 422],
    [KycErrorCode.SANCTIONS_HIT]:               ['Profile blocked by compliance', 451],
    [KycErrorCode.RATE_LIMITED]:                ['Too many attempts, try again later', 429],
    [KycErrorCode.APPEAL_NOT_ALLOWED]:          ['Appeal not allowed in current state', 409],
    [KycErrorCode.APPEAL_ALREADY_PENDING]:      ['Appeal already pending', 409],
    [KycErrorCode.REVERIFY_NOT_ALLOWED]:        ['Re-verification not allowed', 409],
    [KycErrorCode.DOCUMENT_INVALID]:            ['Document is invalid', 422],
  };
  const m = map[code];
  if (!m) return false;
  err(res, code, m[0], m[1]);
  return true;
}

// ── User endpoints ────────────────────────────────────────────────────────────

kycRouter.post('/initiate', authenticate, async (req, res) => {
  const parsed = KycInitiateSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.initiateAadhaarVerification(req.user!.id, parsed.data.redirectUri);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/initiate]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to initiate KYC', 500);
  }
});

kycRouter.get('/callback', authenticate, async (req, res) => {
  const digiCode = req.query['code'];
  if (typeof digiCode !== 'string' || !digiCode) {
    err(res, 'VALIDATION_ERROR', 'Missing DigiLocker code', 400); return;
  }
  const { ip, ua } = reqMeta(req);
  try {
    const result = await service.completeAadhaarVerification(req.user!.id, digiCode, ip, ua);
    ok(res, { message: 'Aadhaar verification submitted for review.', duplicateFlag: result.duplicateFlag });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/callback]', e);
    err(res, 'INTERNAL_ERROR', 'Aadhaar verification failed', 500);
  }
});

kycRouter.post('/photo', authenticate, async (req, res) => {
  const parsed = KycPhotoSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.analyzeProfilePhoto(req.user!.id, parsed.data.r2Key);
    ok(res, { status: result.status, photoAnalysis: result.photoAnalysis });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/photo]', e);
    err(res, 'INTERNAL_ERROR', 'Photo analysis failed', 500);
  }
});

kycRouter.post('/liveness', authenticate, async (req, res) => {
  const parsed = KycLivenessSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  const { ip, ua } = reqMeta(req);
  try {
    const result = await service.submitLiveness(
      req.user!.id, parsed.data.videoR2Key, parsed.data.selfieR2Key, parsed.data.challengesPassed, ip, ua,
    );
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/liveness]', e);
    err(res, 'INTERNAL_ERROR', 'Liveness check failed', 500);
  }
});

kycRouter.post('/face-match', authenticate, async (req, res) => {
  const parsed = KycFaceMatchSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.submitFaceMatch(req.user!.id, parsed.data.selfieR2Key);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/face-match]', e);
    err(res, 'INTERNAL_ERROR', 'Face match failed', 500);
  }
});

kycRouter.post('/pan', authenticate, async (req, res) => {
  const parsed = KycPanSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.submitPan(req.user!.id, parsed.data.pan, parsed.data.nameOnPan, parsed.data.dob);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/pan]', e);
    err(res, 'INTERNAL_ERROR', 'PAN verification failed', 500);
  }
});

kycRouter.post('/bank', authenticate, async (req, res) => {
  const parsed = KycBankSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.submitBank(
      req.user!.id, parsed.data.accountNumber, parsed.data.ifsc, parsed.data.accountHolderName,
    );
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/bank]', e);
    err(res, 'INTERNAL_ERROR', 'Bank verification failed', 500);
  }
});

kycRouter.post('/document', authenticate, async (req, res) => {
  const parsed = KycDocumentSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.uploadKycDocument(
      req.user!.id, parsed.data.documentType, parsed.data.r2Key, parsed.data.documentLast4, parsed.data.expiresAt,
    );
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/document]', e);
    err(res, 'INTERNAL_ERROR', 'Document upload failed', 500);
  }
});

kycRouter.get('/documents', authenticate, async (req, res) => {
  try {
    const docs = await service.listKycDocuments(req.user!.id);
    ok(res, { documents: docs });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/documents]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to load documents', 500);
  }
});

kycRouter.post('/appeal', authenticate, async (req, res) => {
  const parsed = KycAppealSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.fileAppeal(req.user!.id, parsed.data.message, parsed.data.evidenceR2Keys);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/appeal]', e);
    err(res, 'INTERNAL_ERROR', 'Appeal submission failed', 500);
  }
});

kycRouter.get('/appeals', authenticate, async (req, res) => {
  try {
    const appeals = await service.listMyAppeals(req.user!.id);
    ok(res, { appeals });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/appeals]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to load appeals', 500);
  }
});

kycRouter.post('/reverify', authenticate, async (req, res) => {
  const parsed = KycReverifySchema.safeParse(req.body ?? {});
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    const result = await service.requestReverification(req.user!.id);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/reverify]', e);
    err(res, 'INTERNAL_ERROR', 'Re-verification request failed', 500);
  }
});

kycRouter.get('/level', authenticate, async (req, res) => {
  try {
    const result = await service.getLevelGap(req.user!.id);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/level]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch level', 500);
  }
});

kycRouter.get('/audit', authenticate, async (req, res) => {
  try {
    const trail = await service.getMyAuditTrail(req.user!.id);
    ok(res, { trail });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/audit]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch audit trail', 500);
  }
});

kycRouter.get('/status', authenticate, async (req, res) => {
  try {
    const result = await service.getKycStatus(req.user!.id);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/status]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch KYC status', 500);
  }
});

// ── Admin endpoints ───────────────────────────────────────────────────────────

adminKycRouter.get('/pending', authenticate, authorize(['ADMIN']), async (_req, res) => {
  try {
    const pendingProfiles = await service.getPendingKycProfiles();
    ok(res, { profiles: pendingProfiles, total: pendingProfiles.length });
  } catch (e) {
    console.error('[kyc/pending]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch pending KYC queue', 500);
  }
});

adminKycRouter.get('/stats', authenticate, authorize(['ADMIN']), async (_req, res) => {
  try {
    const stats = await service.getKycStats();
    ok(res, stats);
  } catch (e) {
    console.error('[kyc/stats]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch KYC stats', 500);
  }
});

adminKycRouter.get('/:profileId/details', authenticate, authorize(['ADMIN']), async (req, res) => {
  const profileId = req.params['profileId'];
  if (!profileId || !UUID_RE.test(profileId)) { err(res, 'VALIDATION_ERROR', 'Invalid profileId format', 400); return; }
  try {
    const result = await service.getKycDetails(profileId);
    ok(res, result);
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/details]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to fetch KYC details', 500);
  }
});

adminKycRouter.put('/:profileId/approve', authenticate, authorize(['ADMIN']), async (req, res) => {
  const profileId = req.params['profileId'];
  if (!profileId || !UUID_RE.test(profileId)) { err(res, 'VALIDATION_ERROR', 'Invalid profileId format', 400); return; }
  const parsed = AdminReviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    await service.approveKyc(profileId, req.user!.id, parsed.data.note);
    ok(res, { message: 'KYC approved' });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/approve]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to approve KYC', 500);
  }
});

adminKycRouter.put('/:profileId/reject', authenticate, authorize(['ADMIN']), async (req, res) => {
  const profileId = req.params['profileId'];
  if (!profileId || !UUID_RE.test(profileId)) { err(res, 'VALIDATION_ERROR', 'Invalid profileId format', 400); return; }
  const parsed = AdminReviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    await service.rejectKyc(profileId, req.user!.id, parsed.data.note);
    ok(res, { message: 'KYC rejected' });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/reject]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to reject KYC', 500);
  }
});

adminKycRouter.put('/:profileId/request-info', authenticate, authorize(['ADMIN']), async (req, res) => {
  const profileId = req.params['profileId'];
  if (!profileId || !UUID_RE.test(profileId)) { err(res, 'VALIDATION_ERROR', 'Invalid profileId format', 400); return; }
  const parsed = AdminInfoRequestSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    await service.adminRequestInfo(profileId, req.user!.id, parsed.data.note, parsed.data.requiredDocs);
    ok(res, { message: 'Info requested' });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/request-info]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to request info', 500);
  }
});

adminKycRouter.put('/appeals/:appealId/resolve', authenticate, authorize(['ADMIN']), async (req, res) => {
  const appealId = req.params['appealId'];
  if (!appealId || !UUID_RE.test(appealId)) { err(res, 'VALIDATION_ERROR', 'Invalid appealId format', 400); return; }
  const parsed = AdminAppealResolveSchema.safeParse(req.body);
  if (!parsed.success) { err(res, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400); return; }
  try {
    await service.adminResolveAppeal(appealId, req.user!.id, parsed.data.decision, parsed.data.note);
    ok(res, { message: 'Appeal resolved' });
  } catch (e) {
    if (mapKycError(e, res)) return;
    console.error('[kyc/appeal-resolve]', e);
    err(res, 'INTERNAL_ERROR', 'Failed to resolve appeal', 500);
  }
});
