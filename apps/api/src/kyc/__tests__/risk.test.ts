import { describe, it, expect } from 'vitest';
import { assessRisk, computeLevel, describeLevels } from '../risk.js';

const baseInputs = {
  aadhaarVerified: false,
  panVerified:     false,
  bankVerified:    false,
  livenessScore:   null,
  faceMatchScore:  null,
  photoAnalysis:   null,
  duplicateFlag:   false,
  sanctionsHit:    false,
  attemptCount:    0,
  accountAgeDays:  10,
};

describe('assessRisk', () => {
  it('starts at 50 baseline with no signals', () => {
    const r = assessRisk(baseInputs);
    expect(r.score).toBe(50);
    expect(r.decision).toBe('MANUAL_REVIEW');
  });

  it('adds points for each verified signal', () => {
    const r = assessRisk({ ...baseInputs, aadhaarVerified: true, panVerified: true, bankVerified: true });
    expect(r.score).toBeGreaterThanOrEqual(50 + 25 + 15 + 10);
    expect(r.factors.map(f => f.code)).toEqual(expect.arrayContaining(['AADHAAR_VERIFIED','PAN_VERIFIED','BANK_VERIFIED']));
  });

  it('AUTO_VERIFY when score >= 85 and no sanctions', () => {
    const r = assessRisk({
      ...baseInputs,
      aadhaarVerified: true,
      panVerified: true,
      bankVerified: true,
      livenessScore: 90,
      faceMatchScore: 92,
      photoAnalysis: { isRealPerson: true, confidenceScore: 99, hasSunglasses: false, multipleFaces: false, analyzedAt: new Date().toISOString() },
      accountAgeDays: 60,
    });
    expect(r.decision).toBe('AUTO_VERIFY');
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it('AUTO_REJECT when sanctions hit, regardless of score', () => {
    const r = assessRisk({ ...baseInputs, aadhaarVerified: true, sanctionsHit: true });
    expect(r.decision).toBe('AUTO_REJECT');
    expect(r.factors.some(f => f.code === 'SANCTIONS_HIT')).toBe(true);
  });

  it('penalises duplicate device + multiple faces + low liveness', () => {
    const r = assessRisk({
      ...baseInputs,
      duplicateFlag: true,
      livenessScore: 40,
      photoAnalysis: { isRealPerson: false, confidenceScore: 50, hasSunglasses: false, multipleFaces: true, analyzedAt: new Date().toISOString() },
    });
    expect(r.score).toBeLessThan(50);
    expect(r.factors.map(f => f.code)).toEqual(expect.arrayContaining(['DUPLICATE_DEVICE','WEAK_LIVENESS','NOT_REAL_PERSON','MULTIPLE_FACES']));
  });

  it('clamps score to [0, 100]', () => {
    const r = assessRisk({ ...baseInputs, sanctionsHit: true, duplicateFlag: true,
      photoAnalysis: { isRealPerson: false, confidenceScore: 10, hasSunglasses: true, multipleFaces: true, analyzedAt: new Date().toISOString() } });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('computeLevel', () => {
  const photoOk = { isRealPerson: true, confidenceScore: 99, hasSunglasses: false, multipleFaces: false, analyzedAt: '2026-04-28T10:00:00.000Z' };

  it('NONE with nothing verified', () => {
    expect(computeLevel({ aadhaarVerified: false, photoAnalysis: null, livenessScore: null, faceMatchScore: null, panVerified: false, bankVerified: false, addressVerified: false, employmentVerified: false })).toBe('NONE');
  });

  it('BASIC with Aadhaar only', () => {
    expect(computeLevel({ aadhaarVerified: true, photoAnalysis: null, livenessScore: null, faceMatchScore: null, panVerified: false, bankVerified: false, addressVerified: false, employmentVerified: false })).toBe('BASIC');
  });

  it('STANDARD with Aadhaar + photo + liveness + face match', () => {
    expect(computeLevel({ aadhaarVerified: true, photoAnalysis: photoOk, livenessScore: 80, faceMatchScore: 90, panVerified: false, bankVerified: false, addressVerified: false, employmentVerified: false })).toBe('STANDARD');
  });

  it('PREMIUM with Standard + PAN + Bank', () => {
    expect(computeLevel({ aadhaarVerified: true, photoAnalysis: photoOk, livenessScore: 80, faceMatchScore: 90, panVerified: true, bankVerified: true, addressVerified: false, employmentVerified: false })).toBe('PREMIUM');
  });

  it('ELITE with Premium + address + employment', () => {
    expect(computeLevel({ aadhaarVerified: true, photoAnalysis: photoOk, livenessScore: 80, faceMatchScore: 90, panVerified: true, bankVerified: true, addressVerified: true, employmentVerified: true })).toBe('ELITE');
  });
});

describe('describeLevels', () => {
  it('marks BASIC unlocked when Aadhaar verified, others locked', () => {
    const gaps = describeLevels({ aadhaarVerified: true, photoAnalysis: null, livenessScore: null, faceMatchScore: null, panVerified: false, bankVerified: false, addressVerified: false, employmentVerified: false });
    expect(gaps.find(g => g.level === 'BASIC')?.unlocked).toBe(true);
    expect(gaps.find(g => g.level === 'STANDARD')?.unlocked).toBe(false);
    expect(gaps.find(g => g.level === 'STANDARD')?.missing.length).toBeGreaterThan(0);
  });
});
