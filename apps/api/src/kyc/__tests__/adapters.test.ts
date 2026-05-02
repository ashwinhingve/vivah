import { describe, it, expect } from 'vitest';

// Mock-mode env (already true in test env, but ensure)
process.env['USE_MOCK_SERVICES'] = 'true';

import { verifyPan, panFingerprint } from '../pan.js';
import { checkLiveness } from '../liveness.js';
import { compareFaces, FACE_MATCH_THRESHOLD } from '../faceMatch.js';
import { verifyBank } from '../bank.js';
import { checkSanctions } from '../sanctions.js';
import { checkCriminalRecord } from '../criminal.js';

describe('PAN adapter (mock)', () => {
  it('verifies a well-formed PAN', async () => {
    const r = await verifyPan({ pan: 'ABCDE1234F', nameOnPan: 'TEST USER', dob: '1990-01-01' });
    expect(r.verified).toBe(true);
    expect(r.panLast4).toBe('234F');
    expect(r.refId).toMatch(/^MOCK-PAN-/);
  });

  it('rejects malformed PAN', async () => {
    const r = await verifyPan({ pan: 'BAD-PAN', nameOnPan: 'X', dob: '1990-01-01' });
    expect(r.verified).toBe(false);
  });

  it('blocks PANs starting with XXXXX (test-blocked fixture)', async () => {
    const r = await verifyPan({ pan: 'XXXXX1234A', nameOnPan: 'X', dob: '1990-01-01' });
    expect(r.verified).toBe(false);
  });

  it('panFingerprint is deterministic and 32 chars', () => {
    const a = panFingerprint('ABCDE1234F');
    const b = panFingerprint('abcde1234f');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
});

describe('Liveness adapter (mock)', () => {
  it('passes when 2+ challenges submitted', async () => {
    const r = await checkLiveness({ videoR2Key: 'test.webm', challengesPassed: ['BLINK','SMILE','HEAD_TURN_LEFT'] });
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it('fails with no challenges and flags spoof', async () => {
    const r = await checkLiveness({ videoR2Key: 'test.webm', challengesPassed: [] });
    expect(r.passed).toBe(false);
    expect(r.spoofIndicators).toContain('NO_CHALLENGE_RESPONSE');
  });
});

describe('Face match adapter (mock)', () => {
  it('returns deterministic score', async () => {
    const a = await compareFaces({ selfieR2Key: 'k1', aadhaarRefId: 'r1' });
    const b = await compareFaces({ selfieR2Key: 'k1', aadhaarRefId: 'r1' });
    expect(a.score).toBe(b.score);
    expect(a.matched).toBe(a.score >= FACE_MATCH_THRESHOLD);
  });
});

describe('Bank adapter (mock)', () => {
  it('verifies non-blocked accounts', async () => {
    const r = await verifyBank({ accountNumber: '123456789012', ifsc: 'HDFC0001234', accountHolderName: 'Jane Doe' });
    expect(r.verified).toBe(true);
    expect(r.accountLast4).toBe('9012');
  });

  it('blocks accounts starting with 0000', async () => {
    const r = await verifyBank({ accountNumber: '000012345678', ifsc: 'HDFC0001234', accountHolderName: 'Jane Doe' });
    expect(r.verified).toBe(false);
  });
});

describe('Sanctions adapter (mock)', () => {
  it('clears clean names', async () => {
    const r = await checkSanctions({ fullName: 'Aarav Sharma', dob: '1990-01-01', country: 'IN' });
    expect(r.hit).toBe(false);
    expect(r.listsChecked.length).toBeGreaterThan(0);
  });

  it('flags name containing BLOCKED', async () => {
    const r = await checkSanctions({ fullName: 'BLOCKED Person', dob: null, country: 'IN' });
    expect(r.hit).toBe(true);
    expect(r.matchScore).toBeGreaterThanOrEqual(90);
  });
});

describe('Criminal-check adapter (mock)', () => {
  it('clears clean names', async () => {
    const r = await checkCriminalRecord({ fullName: 'Aarav Sharma', dob: null, state: 'MH' });
    expect(r.cleared).toBe(true);
  });

  it('flags names containing CRIMINAL', async () => {
    const r = await checkCriminalRecord({ fullName: 'A CRIMINAL Suspect', dob: null, state: 'MH' });
    expect(r.cleared).toBe(false);
  });
});
