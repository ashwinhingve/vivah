// ─────────────────────────────────────────────────────────────────────────────
// Risk scoring engine.
// Aggregates trust + risk signals into 0–100 score (100 = lowest risk).
// Decision thresholds:
//   score >= 85 && !sanctionsHit         → AUTO_VERIFY
//   sanctionsHit                          → AUTO_REJECT
//   otherwise                             → MANUAL_REVIEW
// ─────────────────────────────────────────────────────────────────────────────
import type { RiskFactor, RiskAssessment, PhotoAnalysis } from '@smartshaadi/types';

export interface RiskInputs {
  aadhaarVerified:  boolean;
  panVerified:      boolean;
  bankVerified:     boolean;
  livenessScore:    number | null;     // 0-100
  faceMatchScore:   number | null;     // 0-100
  photoAnalysis:    PhotoAnalysis | null;
  duplicateFlag:    boolean;
  sanctionsHit:     boolean;
  attemptCount:     number;
  accountAgeDays:   number;
}

const BASE_SCORE = 50;

export function assessRisk(inputs: RiskInputs): RiskAssessment {
  const factors: RiskFactor[] = [];
  let score = BASE_SCORE;

  // ── Trust signals ───────────────────────────────────────────
  if (inputs.aadhaarVerified) {
    factors.push({ code: 'AADHAAR_VERIFIED', impact: +25, detail: 'Aadhaar e-KYC passed' });
    score += 25;
  }
  if (inputs.panVerified) {
    factors.push({ code: 'PAN_VERIFIED', impact: +15, detail: 'PAN verified with provider' });
    score += 15;
  }
  if (inputs.bankVerified) {
    factors.push({ code: 'BANK_VERIFIED', impact: +10, detail: 'Bank account holder confirmed' });
    score += 10;
  }
  if (inputs.livenessScore !== null && inputs.livenessScore >= 80) {
    factors.push({ code: 'STRONG_LIVENESS', impact: +12, detail: `Liveness score ${inputs.livenessScore}` });
    score += 12;
  }
  if (inputs.faceMatchScore !== null && inputs.faceMatchScore >= 85) {
    factors.push({ code: 'STRONG_FACE_MATCH', impact: +12, detail: `Face match ${inputs.faceMatchScore}` });
    score += 12;
  }
  if (inputs.accountAgeDays >= 30) {
    factors.push({ code: 'AGED_ACCOUNT', impact: +5, detail: `Account ${inputs.accountAgeDays} days old` });
    score += 5;
  }

  // ── Risk signals ───────────────────────────────────────────
  if (inputs.duplicateFlag) {
    factors.push({ code: 'DUPLICATE_DEVICE', impact: -25, detail: 'Device fingerprint matches another account' });
    score -= 25;
  }
  if (inputs.photoAnalysis && !inputs.photoAnalysis.isRealPerson) {
    factors.push({ code: 'NOT_REAL_PERSON', impact: -45, detail: 'Photo analysis flagged as non-human' });
    score -= 45;
  }
  if (inputs.photoAnalysis?.multipleFaces) {
    factors.push({ code: 'MULTIPLE_FACES', impact: -20, detail: 'Multiple faces detected in selfie' });
    score -= 20;
  }
  if (inputs.photoAnalysis?.hasSunglasses) {
    factors.push({ code: 'SUNGLASSES', impact: -8, detail: 'Sunglasses obscure facial features' });
    score -= 8;
  }
  if (inputs.livenessScore !== null && inputs.livenessScore < 60) {
    factors.push({ code: 'WEAK_LIVENESS', impact: -25, detail: `Liveness score ${inputs.livenessScore}` });
    score -= 25;
  }
  if (inputs.faceMatchScore !== null && inputs.faceMatchScore < 60) {
    factors.push({ code: 'WEAK_FACE_MATCH', impact: -30, detail: `Face match ${inputs.faceMatchScore}` });
    score -= 30;
  }
  if (inputs.attemptCount >= 3) {
    factors.push({ code: 'REPEATED_ATTEMPTS', impact: -10, detail: `${inputs.attemptCount} prior attempts` });
    score -= 10;
  }
  if (inputs.sanctionsHit) {
    factors.push({ code: 'SANCTIONS_HIT', impact: -100, detail: 'Match on sanctions list' });
    score -= 100;
  }
  if (inputs.accountAgeDays < 1) {
    factors.push({ code: 'BRAND_NEW_ACCOUNT', impact: -8, detail: 'Account created within 24h' });
    score -= 8;
  }

  const finalScore = Math.max(0, Math.min(100, score));
  let decision: RiskAssessment['decision'];
  if (inputs.sanctionsHit) decision = 'AUTO_REJECT';
  else if (finalScore >= 85) decision = 'AUTO_VERIFY';
  else decision = 'MANUAL_REVIEW';

  return {
    score:      finalScore,
    factors,
    decision,
    computedAt: new Date().toISOString(),
  };
}

// ── Verification level computation ───────────────────────────────────────────

import type { KycLevel } from '@smartshaadi/types';

export interface LevelInputs {
  aadhaarVerified:    boolean;
  photoAnalysis:      PhotoAnalysis | null;
  livenessScore:      number | null;
  faceMatchScore:     number | null;
  panVerified:        boolean;
  bankVerified:       boolean;
  addressVerified:    boolean;
  employmentVerified: boolean;
}

export function computeLevel(inputs: LevelInputs): KycLevel {
  const standard =
    !!inputs.aadhaarVerified &&
    !!inputs.photoAnalysis?.isRealPerson &&
    (inputs.livenessScore ?? 0) >= 70 &&
    (inputs.faceMatchScore ?? 0) >= 75;

  if (standard && inputs.panVerified && inputs.bankVerified && inputs.addressVerified && inputs.employmentVerified) return 'ELITE';
  if (standard && inputs.panVerified && inputs.bankVerified) return 'PREMIUM';
  if (standard) return 'STANDARD';
  if (inputs.aadhaarVerified) return 'BASIC';
  return 'NONE';
}

export interface LevelGap {
  level:        KycLevel;
  unlocked:     boolean;
  missing:      string[];
  features:     string[];
}

const LEVEL_FEATURES: Record<KycLevel, string[]> = {
  NONE:     [],
  BASIC:    ['ID Verified badge', 'Send match requests'],
  STANDARD: ['Selfie-verified badge', 'Higher feed ranking', '3× response rate'],
  PREMIUM:  ['Financially verified badge', 'Vendor escrow trust', 'Background-check compatible'],
  ELITE:    ['Elite verified badge', 'Top-of-feed surface', 'Verified-only filters'],
};

export function describeLevels(inputs: LevelInputs): LevelGap[] {
  const cur = computeLevel(inputs);
  const order: KycLevel[] = ['BASIC', 'STANDARD', 'PREMIUM', 'ELITE'];
  return order.map((level) => {
    const missing: string[] = [];
    if (level === 'BASIC' && !inputs.aadhaarVerified) missing.push('Aadhaar verification');
    if (level === 'STANDARD') {
      if (!inputs.aadhaarVerified) missing.push('Aadhaar verification');
      if (!inputs.photoAnalysis?.isRealPerson) missing.push('Profile photo analysis');
      if ((inputs.livenessScore ?? 0) < 70) missing.push('Liveness selfie');
      if ((inputs.faceMatchScore ?? 0) < 75) missing.push('Face match with Aadhaar');
    }
    if (level === 'PREMIUM') {
      if (computeLevel(inputs) === 'NONE' || computeLevel(inputs) === 'BASIC') missing.push('Complete Standard tier first');
      if (!inputs.panVerified) missing.push('PAN verification');
      if (!inputs.bankVerified) missing.push('Bank account verification');
    }
    if (level === 'ELITE') {
      if (!inputs.panVerified || !inputs.bankVerified) missing.push('Complete Premium tier first');
      if (!inputs.addressVerified) missing.push('Address proof');
      if (!inputs.employmentVerified) missing.push('Employment verification');
    }
    return {
      level,
      unlocked: levelRank(cur) >= levelRank(level),
      missing,
      features: LEVEL_FEATURES[level],
    };
  });
}

function levelRank(l: KycLevel): number {
  return ['NONE', 'BASIC', 'STANDARD', 'PREMIUM', 'ELITE'].indexOf(l);
}
