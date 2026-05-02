import { eq, and, ne, desc, sql, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import {
  profiles, session as sessionTable,
  kycVerifications, kycAuditLog, kycDocuments, kycAppeals,
} from '@smartshaadi/db';
import { KycErrorCode } from '@smartshaadi/types';
import type {
  PhotoAnalysis, KycDocumentType, KycLevel,
} from '@smartshaadi/types';
import { analyzePhoto } from './rekognition.js';
import { getDigiLockerAuthUrl, verifyDigiLockerCallback } from './aadhaar.js';
import { verifyPan, panFingerprint } from './pan.js';
import { checkLiveness } from './liveness.js';
import { compareFaces } from './faceMatch.js';
import { verifyBank } from './bank.js';
import { checkSanctions } from './sanctions.js';
import { redis } from './../lib/redis.js';
import { env } from '../lib/env.js';
import { recordKycAuditEvent } from './audit.js';
import { checkKycRateLimit } from './rateLimit.js';
import { assessRisk, computeLevel, describeLevels } from './risk.js';

const DEFAULT_KYC_VALIDITY_DAYS = 365;

function kycErr(code: string): never {
  const e = new Error(code);
  e.name = code;
  throw e;
}

async function loadProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  return profile!;
}

async function loadKyc(profileId: string) {
  const [kyc] = await db.select().from(kycVerifications)
    .where(eq(kycVerifications.profileId, profileId)).limit(1);
  return kyc;
}

async function ensureKycRow(profileId: string) {
  const existing = await loadKyc(profileId);
  if (existing) return existing;
  await db.insert(kycVerifications).values({ profileId });
  return (await loadKyc(profileId))!;
}

function assertNotTerminal(status: string): void {
  if (status === 'VERIFIED')      kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (status === 'REJECTED')      kycErr(KycErrorCode.KYC_REJECTED);
  if (status === 'LOCKED')        kycErr(KycErrorCode.KYC_LOCKED);
}

function assertNotInReview(status: string): void {
  if (status === 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);
}

// ── Aadhaar ──────────────────────────────────────────────────────────────────

export async function initiateAadhaarVerification(userId: string, redirectUri: string) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);
  assertNotInReview(profile.verificationStatus);

  const rate = await checkKycRateLimit(profile.id, 'initiate');
  if (!rate.allowed) {
    if (rate.locked) kycErr(KycErrorCode.KYC_LOCKED);
    kycErr(KycErrorCode.RATE_LIMITED);
  }

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'INITIATED', actorId: userId, actorRole: 'USER',
    fromStatus: profile.verificationStatus, toStatus: profile.verificationStatus,
  });

  return getDigiLockerAuthUrl(redirectUri);
}

export async function completeAadhaarVerification(
  userId: string,
  code: string,
  ipAddress: string,
  device: string,
) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);
  assertNotInReview(profile.verificationStatus);

  // Soft duplicate detection: same IP + userAgent used by a different user
  const otherSessions = await db
    .select({ userId: sessionTable.userId })
    .from(sessionTable)
    .where(and(
      eq(sessionTable.ipAddress, ipAddress),
      eq(sessionTable.userAgent, device),
      ne(sessionTable.userId, userId),
    ))
    .limit(5);

  const duplicateFlag = otherSessions.length > 0;
  const duplicateReason = duplicateFlag
    ? `Device fingerprint matches ${otherSessions.length} other account(s)`
    : null;

  const verifyResult = await verifyDigiLockerCallback(code);
  if (!verifyResult.verified) {
    await recordKycAuditEvent({
      profileId: profile.id, eventType: 'AADHAAR_FAILED', actorId: userId, actorRole: 'USER',
      ipAddress, userAgent: device,
    });
    kycErr(KycErrorCode.AADHAAR_VERIFICATION_FAILED);
  }

  const existing = await loadKyc(profile.id);
  const now = new Date();
  if (!existing) {
    await db.insert(kycVerifications).values({
      profileId:         profile.id,
      aadhaarVerified:   true,
      aadhaarRefId:      verifyResult.refId,
      aadhaarVerifiedAt: now,
      duplicateFlag,
      duplicateReason,
      attemptCount:      1,
      lastAttemptAt:     now,
    });
  } else {
    await db.update(kycVerifications).set({
      aadhaarVerified:   true,
      aadhaarRefId:      verifyResult.refId,
      aadhaarVerifiedAt: now,
      duplicateFlag,
      duplicateReason,
      attemptCount:      (existing.attemptCount ?? 0) + 1,
      lastAttemptAt:     now,
      updatedAt:         now,
    }).where(eq(kycVerifications.profileId, profile.id));
  }

  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: now })
    .where(eq(profiles.id, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'AADHAAR_VERIFIED', actorId: userId, actorRole: 'USER',
    fromStatus: profile.verificationStatus, toStatus: 'MANUAL_REVIEW',
    ipAddress, userAgent: device,
    metadata: { refId: verifyResult.refId, duplicateFlag },
  });

  await runRiskPass(profile.id, userId, ipAddress, device);
  return { duplicateFlag, duplicateReason };
}

// ── Photo (existing keeps backward-compat) ───────────────────────────────────

export async function analyzeProfilePhoto(userId: string, r2Key: string) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);
  assertNotInReview(profile.verificationStatus);

  const photoAnalysis = await analyzePhoto(r2Key);
  const existing = await loadKyc(profile.id);
  if (!existing) {
    await db.insert(kycVerifications).values({ profileId: profile.id, photoAnalysis, selfieR2Key: r2Key });
  } else {
    await db.update(kycVerifications).set({
      photoAnalysis, selfieR2Key: r2Key, updatedAt: new Date(),
    }).where(eq(kycVerifications.profileId, profile.id));
  }

  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'PHOTO_ANALYZED', actorId: userId, actorRole: 'USER',
    metadata: { analysis: photoAnalysis },
  });

  await runRiskPass(profile.id, userId, null, null);
  return { status: 'MANUAL_REVIEW' as const, photoAnalysis };
}

// ── Liveness ────────────────────────────────────────────────────────────────

export async function submitLiveness(
  userId: string,
  videoR2Key: string,
  selfieR2Key: string | undefined,
  challengesPassed: string[],
  ipAddress: string | null,
  device: string | null,
) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);

  const rate = await checkKycRateLimit(profile.id, 'liveness');
  if (!rate.allowed) {
    if (rate.locked) kycErr(KycErrorCode.KYC_LOCKED);
    kycErr(KycErrorCode.RATE_LIMITED);
  }

  const result = await checkLiveness({ videoR2Key, challengesPassed });
  await ensureKycRow(profile.id);
  await db.update(kycVerifications).set({
    livenessScore:      result.score,
    livenessVideoR2Key: videoR2Key,
    livenessCheckedAt:  new Date(),
    ...(selfieR2Key ? { selfieR2Key } : {}),
    updatedAt:          new Date(),
  }).where(eq(kycVerifications.profileId, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'LIVENESS_CHECKED', actorId: userId, actorRole: 'USER',
    ipAddress, userAgent: device,
    metadata: { score: result.score, passed: result.passed, spoofIndicators: result.spoofIndicators },
  });

  if (!result.passed) {
    await db.update(profiles).set({
      verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date(),
    }).where(eq(profiles.id, profile.id));
  }

  await runRiskPass(profile.id, userId, ipAddress, device);
  return result;
}

// ── Face match ──────────────────────────────────────────────────────────────

export async function submitFaceMatch(userId: string, selfieR2Key: string) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);

  const kyc = await loadKyc(profile.id);
  if (!kyc?.aadhaarVerified || !kyc.aadhaarRefId) {
    kycErr(KycErrorCode.AADHAAR_VERIFICATION_FAILED);
  }

  const result = await compareFaces({ selfieR2Key, aadhaarRefId: kyc!.aadhaarRefId! });
  await db.update(kycVerifications).set({
    faceMatchScore:      result.score,
    faceMatchCheckedAt:  new Date(),
    selfieR2Key,
    updatedAt:           new Date(),
  }).where(eq(kycVerifications.profileId, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'FACE_MATCH_CHECKED', actorId: userId, actorRole: 'USER',
    metadata: { score: result.score, matched: result.matched },
  });

  await runRiskPass(profile.id, userId, null, null);
  return result;
}

// ── PAN ─────────────────────────────────────────────────────────────────────

export async function submitPan(userId: string, pan: string, nameOnPan: string, dob: string) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);

  const rate = await checkKycRateLimit(profile.id, 'pan');
  if (!rate.allowed) {
    if (rate.locked) kycErr(KycErrorCode.KYC_LOCKED);
    kycErr(KycErrorCode.RATE_LIMITED);
  }

  const result = await verifyPan({ pan, nameOnPan, dob });
  if (!result.verified) {
    await recordKycAuditEvent({
      profileId: profile.id, eventType: 'PAN_FAILED', actorId: userId, actorRole: 'USER',
    });
    kycErr(KycErrorCode.PAN_VERIFICATION_FAILED);
  }

  await ensureKycRow(profile.id);
  // Store fingerprint alongside refId in metadata for duplicate-PAN detection;
  // never store raw PAN — only last 4
  await db.update(kycVerifications).set({
    panVerified:   true,
    panRefId:      result.refId,
    panLast4:      result.panLast4,
    panVerifiedAt: new Date(),
    updatedAt:     new Date(),
  }).where(eq(kycVerifications.profileId, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'PAN_VERIFIED', actorId: userId, actorRole: 'USER',
    metadata: { refId: result.refId, fingerprint: panFingerprint(pan) },
  });

  await runRiskPass(profile.id, userId, null, null);
  return { verified: true, panLast4: result.panLast4 };
}

// ── Bank ────────────────────────────────────────────────────────────────────

export async function submitBank(
  userId: string,
  accountNumber: string,
  ifsc: string,
  accountHolderName: string,
) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);

  const rate = await checkKycRateLimit(profile.id, 'bank');
  if (!rate.allowed) {
    if (rate.locked) kycErr(KycErrorCode.KYC_LOCKED);
    kycErr(KycErrorCode.RATE_LIMITED);
  }

  const result = await verifyBank({ accountNumber, ifsc, accountHolderName });
  if (!result.verified) {
    await recordKycAuditEvent({
      profileId: profile.id, eventType: 'BANK_FAILED', actorId: userId, actorRole: 'USER',
    });
    kycErr(KycErrorCode.BANK_VERIFICATION_FAILED);
  }

  await ensureKycRow(profile.id);
  await db.update(kycVerifications).set({
    bankVerified:     true,
    bankRefId:        result.refId,
    bankAccountLast4: result.accountLast4,
    bankIfsc:         result.ifsc,
    bankVerifiedAt:   new Date(),
    updatedAt:        new Date(),
  }).where(eq(kycVerifications.profileId, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'BANK_VERIFIED', actorId: userId, actorRole: 'USER',
    metadata: { refId: result.refId },
  });

  await runRiskPass(profile.id, userId, null, null);
  return { verified: true, accountLast4: result.accountLast4 };
}

// ── Documents (passport, voter ID, utility bill, etc.) ──────────────────────

export async function uploadKycDocument(
  userId: string,
  documentType: KycDocumentType,
  r2Key: string,
  documentLast4: string | undefined,
  expiresAt: string | undefined,
) {
  const profile = await loadProfile(userId);
  assertNotTerminal(profile.verificationStatus);

  // Replace existing active doc of same type (uniqueIndex enforces this at DB)
  const expiry = expiresAt ? new Date(expiresAt) : null;
  await db.insert(kycDocuments).values({
    profileId:    profile.id,
    documentType,
    status:       'PENDING',
    r2Key,
    documentLast4: documentLast4 ?? null,
    expiresAt:    expiry,
  }).onConflictDoUpdate({
    target: [kycDocuments.profileId, kycDocuments.documentType],
    set: {
      status:        'PENDING',
      r2Key,
      documentLast4: documentLast4 ?? null,
      expiresAt:     expiry,
      updatedAt:     new Date(),
    },
  });

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'DOCUMENT_UPLOADED', actorId: userId, actorRole: 'USER',
    metadata: { documentType },
  });

  return { status: 'PENDING' as const, documentType };
}

export async function listKycDocuments(userId: string) {
  const profile = await loadProfile(userId);
  return db.select({
    id:            kycDocuments.id,
    documentType:  kycDocuments.documentType,
    status:        kycDocuments.status,
    documentLast4: kycDocuments.documentLast4,
    expiresAt:     kycDocuments.expiresAt,
    uploadedAt:    kycDocuments.uploadedAt,
    verifiedAt:    kycDocuments.verifiedAt,
    rejectionReason: kycDocuments.rejectionReason,
  }).from(kycDocuments)
    .where(eq(kycDocuments.profileId, profile.id))
    .orderBy(desc(kycDocuments.uploadedAt));
}

// ── Appeals ─────────────────────────────────────────────────────────────────

export async function fileAppeal(userId: string, message: string, evidenceR2Keys: string[]) {
  const profile = await loadProfile(userId);
  if (profile.verificationStatus !== 'REJECTED') kycErr(KycErrorCode.APPEAL_NOT_ALLOWED);

  const [pending] = await db.select().from(kycAppeals)
    .where(and(eq(kycAppeals.profileId, profile.id), eq(kycAppeals.status, 'PENDING'))).limit(1);
  if (pending) kycErr(KycErrorCode.APPEAL_ALREADY_PENDING);

  const kyc = await loadKyc(profile.id);
  await db.insert(kycAppeals).values({
    profileId:        profile.id,
    rejectionContext: kyc?.adminNote ?? null,
    userMessage:      message,
    evidenceR2Keys,
    status:           'PENDING',
  });

  await db.update(profiles).set({
    verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date(),
  }).where(eq(profiles.id, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'APPEAL_FILED', actorId: userId, actorRole: 'USER',
    fromStatus: 'REJECTED', toStatus: 'MANUAL_REVIEW',
  });
  return { status: 'PENDING' as const };
}

export async function listMyAppeals(userId: string) {
  const profile = await loadProfile(userId);
  return db.select({
    id:           kycAppeals.id,
    status:       kycAppeals.status,
    userMessage:  kycAppeals.userMessage,
    resolverNote: kycAppeals.resolverNote,
    createdAt:    kycAppeals.createdAt,
    resolvedAt:   kycAppeals.resolvedAt,
  }).from(kycAppeals).where(eq(kycAppeals.profileId, profile.id))
    .orderBy(desc(kycAppeals.createdAt));
}

// ── Re-verification ─────────────────────────────────────────────────────────

export async function requestReverification(userId: string) {
  const profile = await loadProfile(userId);
  if (profile.verificationStatus !== 'VERIFIED' && profile.verificationStatus !== 'EXPIRED') {
    kycErr(KycErrorCode.REVERIFY_NOT_ALLOWED);
  }
  const kyc = await loadKyc(profile.id);
  await db.update(kycVerifications).set({
    reverificationRequestedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(kycVerifications.profileId, profile.id));

  await db.update(profiles).set({
    verificationStatus: 'PENDING', updatedAt: new Date(),
  }).where(eq(profiles.id, profile.id));

  await recordKycAuditEvent({
    profileId: profile.id, eventType: 'REVERIFICATION_REQUESTED', actorId: userId, actorRole: 'USER',
    fromStatus: profile.verificationStatus, toStatus: 'PENDING',
    metadata: { previousLevel: kyc?.verificationLevel },
  });
  return { status: 'PENDING' as const };
}

// ── Audit trail (user-facing) ───────────────────────────────────────────────

export async function getMyAuditTrail(userId: string) {
  const profile = await loadProfile(userId);
  return db.select({
    id:         kycAuditLog.id,
    eventType:  kycAuditLog.eventType,
    actorRole:  kycAuditLog.actorRole,
    fromStatus: kycAuditLog.fromStatus,
    toStatus:   kycAuditLog.toStatus,
    fromLevel:  kycAuditLog.fromLevel,
    toLevel:    kycAuditLog.toLevel,
    metadata:   kycAuditLog.metadata,
    createdAt:  kycAuditLog.createdAt,
  }).from(kycAuditLog)
    .where(eq(kycAuditLog.profileId, profile.id))
    .orderBy(desc(kycAuditLog.createdAt))
    .limit(100);
}

// ── Status / Level ──────────────────────────────────────────────────────────

export async function getKycStatus(userId: string) {
  const profile = await loadProfile(userId);
  const kyc = await loadKyc(profile.id);

  return {
    verificationStatus: profile.verificationStatus,
    verificationLevel:  (kyc?.verificationLevel ?? 'NONE') as KycLevel,
    aadhaarVerified:    kyc?.aadhaarVerified ?? false,
    panVerified:        kyc?.panVerified ?? false,
    bankVerified:       kyc?.bankVerified ?? false,
    livenessScore:      kyc?.livenessScore ?? null,
    faceMatchScore:     kyc?.faceMatchScore ?? null,
    riskScore:          kyc?.riskScore ?? null,
    expiresAt:          kyc?.expiresAt?.toISOString() ?? null,
    attemptCount:       kyc?.attemptCount ?? 0,
    lockedUntil:        kyc?.lockedUntil?.toISOString() ?? null,
    duplicateFlag:      kyc?.duplicateFlag ?? false,
    photoAnalysis:      (kyc?.photoAnalysis as PhotoAnalysis | null) ?? null,
    adminNote:          kyc?.adminNote ?? null,
  };
}

export async function getLevelGap(userId: string) {
  const profile = await loadProfile(userId);
  const kyc = await loadKyc(profile.id);
  return {
    current: (kyc?.verificationLevel ?? 'NONE') as KycLevel,
    levels: describeLevels({
      aadhaarVerified:    kyc?.aadhaarVerified ?? false,
      photoAnalysis:      (kyc?.photoAnalysis as PhotoAnalysis | null) ?? null,
      livenessScore:      kyc?.livenessScore ?? null,
      faceMatchScore:     kyc?.faceMatchScore ?? null,
      panVerified:        kyc?.panVerified ?? false,
      bankVerified:       kyc?.bankVerified ?? false,
      addressVerified:    kyc?.addressVerified ?? false,
      employmentVerified: kyc?.employmentVerified ?? false,
    }),
  };
}

// ── Risk pass — runs after every signal-changing event ──────────────────────

async function runRiskPass(
  profileId: string,
  actorId: string | null,
  ipAddress: string | null,
  userAgent: string | null,
) {
  const kyc = await loadKyc(profileId);
  if (!kyc) return;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) return;

  const accountAgeDays = Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000);

  const risk = assessRisk({
    aadhaarVerified: kyc.aadhaarVerified,
    panVerified:     kyc.panVerified,
    bankVerified:    kyc.bankVerified,
    livenessScore:   kyc.livenessScore,
    faceMatchScore:  kyc.faceMatchScore,
    photoAnalysis:   (kyc.photoAnalysis as PhotoAnalysis | null) ?? null,
    duplicateFlag:   kyc.duplicateFlag,
    sanctionsHit:    kyc.sanctionsHit,
    attemptCount:    kyc.attemptCount,
    accountAgeDays,
  });

  const newLevel = computeLevel({
    aadhaarVerified:    kyc.aadhaarVerified,
    photoAnalysis:      (kyc.photoAnalysis as PhotoAnalysis | null) ?? null,
    livenessScore:      kyc.livenessScore,
    faceMatchScore:     kyc.faceMatchScore,
    panVerified:        kyc.panVerified,
    bankVerified:       kyc.bankVerified,
    addressVerified:    kyc.addressVerified,
    employmentVerified: kyc.employmentVerified,
  });

  await db.update(kycVerifications).set({
    riskScore:         risk.score,
    riskFactors:       risk.factors,
    verificationLevel: newLevel,
    updatedAt:         new Date(),
  }).where(eq(kycVerifications.profileId, profileId));

  await recordKycAuditEvent({
    profileId, eventType: 'RISK_SCORED', actorId, actorRole: 'SYSTEM',
    fromLevel: kyc.verificationLevel as KycLevel | null,
    toLevel:   newLevel,
    ipAddress, userAgent,
    metadata: { score: risk.score, decision: risk.decision, factors: risk.factors },
  });

  if (newLevel !== kyc.verificationLevel) {
    await recordKycAuditEvent({
      profileId, eventType: 'LEVEL_UPGRADED', actorId, actorRole: 'SYSTEM',
      fromLevel: kyc.verificationLevel as KycLevel | null,
      toLevel:   newLevel,
    });
  }

  // Auto-decision branches
  if (risk.decision === 'AUTO_REJECT') {
    await db.update(profiles).set({
      verificationStatus: 'REJECTED', updatedAt: new Date(),
    }).where(eq(profiles.id, profileId));
    await db.update(kycVerifications).set({
      adminNote: 'Auto-rejected: sanctions hit or critical risk factors',
      updatedAt: new Date(),
    }).where(eq(kycVerifications.profileId, profileId));
    await recordKycAuditEvent({
      profileId, eventType: 'AUTO_REJECTED', actorId: null, actorRole: 'SYSTEM',
      fromStatus: profile.verificationStatus, toStatus: 'REJECTED',
      metadata: { score: risk.score, factors: risk.factors },
    });
    await invalidateFeedCache();
    return;
  }

  if (risk.decision === 'AUTO_VERIFY' && profile.verificationStatus !== 'VERIFIED') {
    const expiresAt = new Date(Date.now() + DEFAULT_KYC_VALIDITY_DAYS * 86_400_000);
    await db.update(profiles).set({
      verificationStatus: 'VERIFIED', updatedAt: new Date(),
    }).where(eq(profiles.id, profileId));
    await db.update(kycVerifications).set({
      expiresAt, updatedAt: new Date(),
    }).where(eq(kycVerifications.profileId, profileId));
    await recordKycAuditEvent({
      profileId, eventType: 'AUTO_VERIFIED', actorId: null, actorRole: 'SYSTEM',
      fromStatus: profile.verificationStatus, toStatus: 'VERIFIED',
      metadata: { score: risk.score, expiresAt: expiresAt.toISOString() },
    });
    await invalidateFeedCache();
  }
}

// ── Sanctions check (called by admin or scheduled) ──────────────────────────

export async function runSanctionsCheck(profileId: string, fullName: string, dob: string | null) {
  const result = await checkSanctions({ fullName, dob, country: 'IN' });
  await ensureKycRow(profileId);
  await db.update(kycVerifications).set({
    sanctionsCheckedAt: new Date(),
    sanctionsHit:       result.hit,
    sanctionsLists:     result.listsChecked,
    updatedAt:          new Date(),
  }).where(eq(kycVerifications.profileId, profileId));
  await recordKycAuditEvent({
    profileId, eventType: result.hit ? 'SANCTIONS_HIT' : 'SANCTIONS_CHECKED',
    actorRole: 'SYSTEM', metadata: { listsChecked: result.listsChecked, matchScore: result.matchScore },
  });
  if (result.hit) await runRiskPass(profileId, null, null, null);
  return result;
}

// ── Admin Review ────────────────────────────────────────────────────────────

export async function getPendingKycProfiles() {
  return db
    .select({
      profileId:          profiles.id,
      userId:             profiles.userId,
      verificationStatus: profiles.verificationStatus,
      verificationLevel:  kycVerifications.verificationLevel,
      aadhaarVerified:    kycVerifications.aadhaarVerified,
      panVerified:        kycVerifications.panVerified,
      bankVerified:       kycVerifications.bankVerified,
      livenessScore:      kycVerifications.livenessScore,
      faceMatchScore:     kycVerifications.faceMatchScore,
      riskScore:          kycVerifications.riskScore,
      duplicateFlag:      kycVerifications.duplicateFlag,
      duplicateReason:    kycVerifications.duplicateReason,
      sanctionsHit:       kycVerifications.sanctionsHit,
      photoAnalysis:      kycVerifications.photoAnalysis,
      submittedAt:        kycVerifications.createdAt,
      attemptCount:       kycVerifications.attemptCount,
    })
    .from(profiles)
    .leftJoin(kycVerifications, eq(kycVerifications.profileId, profiles.id))
    .where(eq(profiles.verificationStatus, 'MANUAL_REVIEW'))
    .orderBy(sql`${kycVerifications.riskScore} ASC NULLS LAST`);
}

export async function getKycDetails(profileId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  const kyc = await loadKyc(profileId);
  const docs = await db.select().from(kycDocuments)
    .where(eq(kycDocuments.profileId, profileId)).orderBy(desc(kycDocuments.uploadedAt));
  const auditTrail = await db.select().from(kycAuditLog)
    .where(eq(kycAuditLog.profileId, profileId))
    .orderBy(desc(kycAuditLog.createdAt)).limit(100);
  const appeals = await db.select().from(kycAppeals)
    .where(eq(kycAppeals.profileId, profileId)).orderBy(desc(kycAppeals.createdAt));
  return { profile, kyc, documents: docs, auditTrail, appeals };
}

export async function approveKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile!.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile!.verificationStatus !== 'MANUAL_REVIEW' && profile!.verificationStatus !== 'INFO_REQUESTED') {
    kycErr(KycErrorCode.KYC_IN_REVIEW);
  }

  const kycRecord = await loadKyc(profileId);
  const expiresAt = new Date(Date.now() + DEFAULT_KYC_VALIDITY_DAYS * 86_400_000);

  await db.update(profiles)
    .set({ verificationStatus: 'VERIFIED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  if (kycRecord) {
    await db.update(kycVerifications).set({
      adminNote:  note ?? null,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      expiresAt,
      updatedAt:  new Date(),
    }).where(eq(kycVerifications.profileId, profileId));
  } else {
    console.warn(`[kyc] approveKyc: no kycVerifications row for profile ${profileId}`);
  }

  await recordKycAuditEvent({
    profileId, eventType: 'MANUAL_APPROVED', actorId: adminUserId, actorRole: 'ADMIN',
    fromStatus: profile!.verificationStatus, toStatus: 'VERIFIED',
    metadata: { note, expiresAt: expiresAt.toISOString() },
  });

  await invalidateFeedCache();
}

export async function rejectKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile!.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile!.verificationStatus !== 'MANUAL_REVIEW' && profile!.verificationStatus !== 'INFO_REQUESTED') {
    kycErr(KycErrorCode.KYC_IN_REVIEW);
  }

  const kycRecord = await loadKyc(profileId);

  await db.update(profiles)
    .set({ verificationStatus: 'REJECTED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  if (kycRecord) {
    await db.update(kycVerifications).set({
      adminNote:  note ?? null,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt:  new Date(),
    }).where(eq(kycVerifications.profileId, profileId));
  } else {
    console.warn(`[kyc] rejectKyc: no kycVerifications row for profile ${profileId}`);
  }

  await recordKycAuditEvent({
    profileId, eventType: 'MANUAL_REJECTED', actorId: adminUserId, actorRole: 'ADMIN',
    fromStatus: profile!.verificationStatus, toStatus: 'REJECTED',
    metadata: { note },
  });

  await invalidateFeedCache();
}

export async function adminRequestInfo(
  profileId: string,
  adminUserId: string,
  note: string,
  requiredDocs: string[],
) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  await db.update(profiles)
    .set({ verificationStatus: 'INFO_REQUESTED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  await db.update(kycVerifications).set({
    adminNote: note, reviewedBy: adminUserId, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(kycVerifications.profileId, profileId));

  await recordKycAuditEvent({
    profileId, eventType: 'INFO_REQUESTED', actorId: adminUserId, actorRole: 'ADMIN',
    fromStatus: profile!.verificationStatus, toStatus: 'INFO_REQUESTED',
    metadata: { note, requiredDocs },
  });
}

export async function adminResolveAppeal(
  appealId: string,
  adminUserId: string,
  decision: 'UPHOLD' | 'DENY',
  note?: string,
) {
  const [appeal] = await db.select().from(kycAppeals)
    .where(eq(kycAppeals.id, appealId)).limit(1);
  if (!appeal) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  const newStatus = decision === 'UPHOLD' ? 'UPHELD' : 'DENIED';

  await db.update(kycAppeals).set({
    status:       newStatus,
    resolverId:   adminUserId,
    resolverNote: note ?? null,
    resolvedAt:   new Date(),
    updatedAt:    new Date(),
  }).where(eq(kycAppeals.id, appealId));

  if (decision === 'UPHOLD') {
    await db.update(profiles).set({
      verificationStatus: 'VERIFIED', updatedAt: new Date(),
    }).where(eq(profiles.id, appeal!.profileId));
    await recordKycAuditEvent({
      profileId: appeal!.profileId, eventType: 'APPEAL_UPHELD', actorId: adminUserId, actorRole: 'ADMIN',
      fromStatus: 'REJECTED', toStatus: 'VERIFIED', metadata: { appealId, note },
    });
    await invalidateFeedCache();
  } else {
    await db.update(profiles).set({
      verificationStatus: 'REJECTED', updatedAt: new Date(),
    }).where(eq(profiles.id, appeal!.profileId));
    await recordKycAuditEvent({
      profileId: appeal!.profileId, eventType: 'APPEAL_DENIED', actorId: adminUserId, actorRole: 'ADMIN',
      fromStatus: 'MANUAL_REVIEW', toStatus: 'REJECTED', metadata: { appealId, note },
    });
  }
}

export async function getKycStats() {
  const [pending] = await db.select({ n: count() }).from(profiles)
    .where(eq(profiles.verificationStatus, 'MANUAL_REVIEW'));
  const [verified] = await db.select({ n: count() }).from(profiles)
    .where(eq(profiles.verificationStatus, 'VERIFIED'));
  const [rejected] = await db.select({ n: count() }).from(profiles)
    .where(eq(profiles.verificationStatus, 'REJECTED'));
  const [infoRequested] = await db.select({ n: count() }).from(profiles)
    .where(eq(profiles.verificationStatus, 'INFO_REQUESTED'));
  const [pendingAppeals] = await db.select({ n: count() }).from(kycAppeals)
    .where(eq(kycAppeals.status, 'PENDING'));
  const [duplicates] = await db.select({ n: count() }).from(kycVerifications)
    .where(eq(kycVerifications.duplicateFlag, true));
  const [sanctions] = await db.select({ n: count() }).from(kycVerifications)
    .where(eq(kycVerifications.sanctionsHit, true));

  return {
    pending:        pending?.n ?? 0,
    verified:       verified?.n ?? 0,
    rejected:       rejected?.n ?? 0,
    infoRequested:  infoRequested?.n ?? 0,
    pendingAppeals: pendingAppeals?.n ?? 0,
    duplicates:     duplicates?.n ?? 0,
    sanctions:      sanctions?.n ?? 0,
  };
}

// ── Cache invalidation ──────────────────────────────────────────────────────

async function invalidateFeedCache(): Promise<void> {
  if (env.USE_MOCK_SERVICES) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'match_feed:*', 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (e) {
    console.error('[kyc] invalidateFeedCache failed:', e);
  }
}
