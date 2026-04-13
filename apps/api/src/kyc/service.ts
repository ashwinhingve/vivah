import { eq, and, ne } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { profiles, session as sessionTable, kycVerifications } from '@smartshaadi/db';
import { KycErrorCode } from '@smartshaadi/types';
import type { PhotoAnalysis } from '@smartshaadi/types';
import { analyzePhoto } from './rekognition.js';
import { getDigiLockerAuthUrl, verifyDigiLockerCallback } from './aadhaar.js';

function kycErr(code: string): never {
  const e = new Error(code);
  e.name = code;
  throw e;
}

// ── Aadhaar Verification ──────────────────────────────────────────────────────

export async function initiateAadhaarVerification(userId: string, redirectUri: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED')      kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus === 'REJECTED')      kycErr(KycErrorCode.KYC_REJECTED);
  if (profile.verificationStatus === 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

  return getDigiLockerAuthUrl(redirectUri);
}

export async function completeAadhaarVerification(
  userId: string,
  code: string,
  ipAddress: string,
  device: string,
) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED')      kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus === 'REJECTED')      kycErr(KycErrorCode.KYC_REJECTED);
  if (profile.verificationStatus === 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

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
  if (!verifyResult.verified) kycErr(KycErrorCode.AADHAAR_VERIFICATION_FAILED);
  // verifyResult.name (if present) is intentionally not persisted

  const [existing] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profile.id))
    .limit(1);

  if (!existing) {
    await db.insert(kycVerifications).values({
      profileId:       profile.id,
      aadhaarVerified: true,
      aadhaarRefId:    verifyResult.refId,
      duplicateFlag,
      duplicateReason,
    });
  } else {
    await db.update(kycVerifications).set({
      aadhaarVerified: true,
      aadhaarRefId:    verifyResult.refId,
      duplicateFlag,
      duplicateReason,
      updatedAt:       new Date(),
    }).where(eq(kycVerifications.profileId, profile.id));
  }

  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  return { duplicateFlag, duplicateReason };
}

// ── Photo Fraud Detection ─────────────────────────────────────────────────────

export async function analyzeProfilePhoto(userId: string, r2Key: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED')      kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus === 'REJECTED')      kycErr(KycErrorCode.KYC_REJECTED);
  if (profile.verificationStatus === 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

  const photoAnalysis = await analyzePhoto(r2Key);

  const [existingKyc] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profile.id))
    .limit(1);

  if (!existingKyc) {
    await db.insert(kycVerifications).values({
      profileId:    profile.id,
      photoAnalysis,
    });
  } else {
    await db.update(kycVerifications)
      .set({ photoAnalysis, updatedAt: new Date() })
      .where(eq(kycVerifications.profileId, profile.id));
  }

  // Never auto-reject — always MANUAL_REVIEW for admin to decide
  await db.update(profiles)
    .set({ verificationStatus: 'MANUAL_REVIEW', updatedAt: new Date() })
    .where(eq(profiles.id, profile.id));

  return { status: 'MANUAL_REVIEW' as const, photoAnalysis };
}

// ── Status Query ──────────────────────────────────────────────────────────────

export async function getKycStatus(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);

  const [kyc] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profile.id))
    .limit(1);

  return {
    verificationStatus: profile.verificationStatus,
    aadhaarVerified:    kyc?.aadhaarVerified ?? false,
    duplicateFlag:      kyc?.duplicateFlag ?? false,
    photoAnalysis:      (kyc?.photoAnalysis as PhotoAnalysis | null) ?? null,
    adminNote:          kyc?.adminNote ?? null,
  };
}

// ── Admin Review Queue ────────────────────────────────────────────────────────

export async function getPendingKycProfiles() {
  return db
    .select({
      profileId:          profiles.id,
      userId:             profiles.userId,
      verificationStatus: profiles.verificationStatus,
      aadhaarVerified:    kycVerifications.aadhaarVerified,
      duplicateFlag:      kycVerifications.duplicateFlag,
      duplicateReason:    kycVerifications.duplicateReason,
      photoAnalysis:      kycVerifications.photoAnalysis,
      submittedAt:        kycVerifications.createdAt,
    })
    .from(profiles)
    .leftJoin(kycVerifications, eq(kycVerifications.profileId, profiles.id))
    .where(eq(profiles.verificationStatus, 'MANUAL_REVIEW'));
}

export async function approveKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus !== 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

  const [kycRecord] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profileId))
    .limit(1);

  await db.update(profiles)
    .set({ verificationStatus: 'VERIFIED', updatedAt: new Date() })
    .where(eq(profiles.id, profileId));

  if (kycRecord) {
    await db.update(kycVerifications).set({
      adminNote:  note ?? null,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt:  new Date(),
    }).where(eq(kycVerifications.profileId, profileId));
  } else {
    console.warn(`[kyc] approveKyc: no kycVerifications row for profile ${profileId}`);
  }
}

export async function rejectKyc(profileId: string, adminUserId: string, note?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!profile) kycErr(KycErrorCode.PROFILE_NOT_FOUND);
  if (profile.verificationStatus === 'VERIFIED') kycErr(KycErrorCode.KYC_ALREADY_VERIFIED);
  if (profile.verificationStatus !== 'MANUAL_REVIEW') kycErr(KycErrorCode.KYC_IN_REVIEW);

  const [kycRecord] = await db
    .select()
    .from(kycVerifications)
    .where(eq(kycVerifications.profileId, profileId))
    .limit(1);

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
}
