import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycErrorCode } from '@smartshaadi/types';

vi.mock('../aadhaar.js', () => ({
  getDigiLockerAuthUrl: vi.fn().mockResolvedValue({
    authUrl: 'https://test.com/callback?state=abc&mock=true',
    state: 'abc',
  }),
  verifyDigiLockerCallback: vi.fn().mockResolvedValue({
    verified: true,
    refId: 'MOCK-123456',
  }),
}));

vi.mock('../rekognition.js', () => ({
  analyzePhoto: vi.fn().mockResolvedValue({
    isRealPerson: true,
    confidenceScore: 98.5,
    hasSunglasses: false,
    multipleFaces: false,
    analyzedAt: '2026-04-07T10:00:00.000Z',
  }),
}));

vi.mock('../../lib/db.js', () => {
  const chain = () => ({
    from:     vi.fn().mockReturnThis(),
    where:    vi.fn().mockReturnThis(),
    limit:    vi.fn().mockResolvedValue([]),
    leftJoin: vi.fn().mockReturnThis(),
    set:      vi.fn().mockReturnThis(),
    values:   vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
  });
  return {
    db: {
      select: vi.fn(chain),
      insert: vi.fn(chain),
      update: vi.fn(chain),
    },
  };
});

import { db } from '../../lib/db.js';
import {
  initiateAadhaarVerification,
  completeAadhaarVerification,
  analyzeProfilePhoto,
  getKycStatus,
  approveKyc,
  rejectKyc,
} from '../service.js';

const mockProfile = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  verificationStatus: 'PENDING' as const,
};

function setupSelectReturns(...results: unknown[][]) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const returnValue = results[call] ?? [];
    call++;
    const c = {
      from:     vi.fn().mockReturnThis(),
      where:    vi.fn().mockReturnThis(),
      limit:    vi.fn().mockResolvedValue(returnValue),
      leftJoin: vi.fn().mockReturnThis(),
    };
    return c as unknown as ReturnType<typeof db.select>;
  });
}

function setupUpdateOk() {
  vi.mocked(db.update).mockImplementation((() => {
    const c = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    return c as unknown as ReturnType<typeof db.update>;
  }) as typeof db.update);
}

function setupInsertOk() {
  vi.mocked(db.insert).mockImplementation((() => {
    const c = { values: vi.fn().mockResolvedValue([]) };
    return c as unknown as ReturnType<typeof db.insert>;
  }) as typeof db.insert);
}

beforeEach(() => vi.clearAllMocks());

// ── initiateAadhaarVerification ───────────────────────────────────────────────

describe('initiateAadhaarVerification', () => {
  it('returns authUrl for a PENDING profile', async () => {
    setupSelectReturns([mockProfile]);
    const result = await initiateAadhaarVerification('user-uuid-1', 'https://test.com/callback');
    expect(result.authUrl).toContain('mock=true');
    expect(result.state).toBe('abc');
  });

  it('throws KYC_ALREADY_VERIFIED for a VERIFIED profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'VERIFIED' }]);
    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_ALREADY_VERIFIED });
  });

  it('throws PROFILE_NOT_FOUND when profile does not exist', async () => {
    setupSelectReturns([]);
    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });

  it('throws KYC_REJECTED for a REJECTED profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'REJECTED' }]);
    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_REJECTED });
  });

  it('throws KYC_IN_REVIEW for a MANUAL_REVIEW profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'MANUAL_REVIEW' }]);
    await expect(initiateAadhaarVerification('user-uuid-1', 'https://test.com'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_IN_REVIEW });
  });
});

// ── completeAadhaarVerification ───────────────────────────────────────────────

describe('completeAadhaarVerification', () => {
  it('returns duplicateFlag=false when no other sessions match', async () => {
    // profile select, sessions select (empty = no duplicates), kyc select (empty = insert path)
    setupSelectReturns([mockProfile], [], []);
    setupInsertOk();
    setupUpdateOk();
    const result = await completeAadhaarVerification('user-uuid-1', 'code-abc', '1.2.3.4', 'Chrome/120');
    expect(result.duplicateFlag).toBe(false);
    expect(result.duplicateReason).toBeNull();
  });

  it('returns duplicateFlag=true when another session matches IP+device', async () => {
    const otherSession = { userId: 'other-user-uuid' };
    setupSelectReturns([mockProfile], [otherSession], []);
    setupInsertOk();
    setupUpdateOk();
    const result = await completeAadhaarVerification('user-uuid-1', 'code-abc', '1.2.3.4', 'Chrome/120');
    expect(result.duplicateFlag).toBe(true);
    expect(result.duplicateReason).toContain('other account');
  });

  it('throws KYC_ALREADY_VERIFIED for a VERIFIED profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'VERIFIED' }]);
    await expect(completeAadhaarVerification('user-uuid-1', 'code-abc', '1.2.3.4', 'Chrome/120'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_ALREADY_VERIFIED });
  });

  it('throws KYC_REJECTED for a REJECTED profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'REJECTED' }]);
    await expect(completeAadhaarVerification('user-uuid-1', 'code-abc', '1.2.3.4', 'Chrome/120'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_REJECTED });
  });

  it('throws KYC_IN_REVIEW for a MANUAL_REVIEW profile', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'MANUAL_REVIEW' }]);
    await expect(completeAadhaarVerification('user-uuid-1', 'code-abc', '1.2.3.4', 'Chrome/120'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_IN_REVIEW });
  });

  it('throws AADHAAR_VERIFICATION_FAILED when DigiLocker returns verified=false', async () => {
    const { verifyDigiLockerCallback } = await import('../aadhaar.js');
    vi.mocked(verifyDigiLockerCallback).mockResolvedValueOnce({ verified: false, refId: '' });
    setupSelectReturns([mockProfile], []);
    await expect(completeAadhaarVerification('user-uuid-1', 'code-bad', '1.2.3.4', 'Chrome/120'))
      .rejects.toMatchObject({ name: KycErrorCode.AADHAAR_VERIFICATION_FAILED });
  });
});

// ── analyzeProfilePhoto ───────────────────────────────────────────────────────

describe('analyzeProfilePhoto', () => {
  it('returns MANUAL_REVIEW with photoAnalysis (update path — existing KYC row)', async () => {
    // profile select, then existingKyc select (found → update path)
    setupSelectReturns([mockProfile], [{ profileId: 'profile-uuid-1' }]);
    setupUpdateOk();
    const result = await analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg');
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.photoAnalysis.isRealPerson).toBe(true);
  });

  it('returns MANUAL_REVIEW with photoAnalysis (insert path — no existing KYC row)', async () => {
    // profile select, then existingKyc select (empty → insert path)
    setupSelectReturns([mockProfile], []);
    setupInsertOk();
    setupUpdateOk();
    const result = await analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg');
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.photoAnalysis.isRealPerson).toBe(true);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('throws PROFILE_NOT_FOUND when no profile exists', async () => {
    setupSelectReturns([]);
    await expect(analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });

  it('throws KYC_IN_REVIEW when profile is in MANUAL_REVIEW', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'MANUAL_REVIEW' }]);
    await expect(analyzeProfilePhoto('user-uuid-1', 'profiles/test/photo.jpg'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_IN_REVIEW });
  });

  it('still returns MANUAL_REVIEW even when fraud is detected (never auto-reject)', async () => {
    const { analyzePhoto } = await import('../rekognition.js');
    vi.mocked(analyzePhoto).mockResolvedValueOnce({
      isRealPerson: false,
      confidenceScore: 12,
      hasSunglasses: false,
      multipleFaces: true,
      analyzedAt: '2026-04-07T10:00:00.000Z',
    });
    // profile select, then existingKyc select (found → update path)
    setupSelectReturns([mockProfile], [{ profileId: 'profile-uuid-1' }]);
    setupUpdateOk();
    const result = await analyzeProfilePhoto('user-uuid-1', 'profiles/fraud/photo.jpg');
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.photoAnalysis.isRealPerson).toBe(false);
  });
});

// ── getKycStatus ──────────────────────────────────────────────────────────────

describe('getKycStatus', () => {
  it('returns defaults when no KYC record exists yet', async () => {
    setupSelectReturns([mockProfile], []);
    const result = await getKycStatus('user-uuid-1');
    expect(result.verificationStatus).toBe('PENDING');
    expect(result.aadhaarVerified).toBe(false);
    expect(result.photoAnalysis).toBeNull();
    expect(result.adminNote).toBeNull();
  });
});

// ── approveKyc / rejectKyc ────────────────────────────────────────────────────

describe('approveKyc', () => {
  it('calls db.update twice (profiles + kyc_verifications)', async () => {
    setupSelectReturns(
      [{ ...mockProfile, verificationStatus: 'MANUAL_REVIEW' }],  // profile
      [{ profileId: 'profile-uuid-1' }],                           // kycRecord exists
    );
    setupUpdateOk();
    await approveKyc('profile-uuid-1', 'admin-uuid-1', 'Looks authentic');
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('throws PROFILE_NOT_FOUND for unknown profileId', async () => {
    setupSelectReturns([]);
    await expect(approveKyc('bad-id', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.PROFILE_NOT_FOUND });
  });

  it('throws KYC_ALREADY_VERIFIED when profile is already VERIFIED', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'VERIFIED' }]);
    await expect(approveKyc('profile-uuid-1', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_ALREADY_VERIFIED });
  });

  it('throws KYC_IN_REVIEW when profile is not in MANUAL_REVIEW status', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'PENDING' }]);
    await expect(approveKyc('profile-uuid-1', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_IN_REVIEW });
  });
});

describe('rejectKyc', () => {
  it('calls db.update twice (profiles + kyc_verifications)', async () => {
    setupSelectReturns(
      [{ ...mockProfile, verificationStatus: 'MANUAL_REVIEW' }],  // profile
      [{ profileId: 'profile-uuid-1' }],                           // kycRecord exists
    );
    setupUpdateOk();
    await rejectKyc('profile-uuid-1', 'admin-uuid-1', 'Photo is fake');
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('throws KYC_ALREADY_VERIFIED when profile is already VERIFIED', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'VERIFIED' }]);
    await expect(rejectKyc('profile-uuid-1', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_ALREADY_VERIFIED });
  });

  it('throws KYC_IN_REVIEW when profile is not in MANUAL_REVIEW status', async () => {
    setupSelectReturns([{ ...mockProfile, verificationStatus: 'PENDING' }]);
    await expect(rejectKyc('profile-uuid-1', 'admin-uuid-1'))
      .rejects.toMatchObject({ name: KycErrorCode.KYC_IN_REVIEW });
  });
});
