import { describe, it, expect } from 'vitest';
import { getDigiLockerAuthUrl, verifyDigiLockerCallback } from '../aadhaar.js';

describe('getDigiLockerAuthUrl (mock)', () => {
  it('returns an authUrl containing the redirectUri', async () => {
    const result = await getDigiLockerAuthUrl('https://app.smartshaadi.co.in/kyc/callback');
    expect(result.authUrl).toContain('https://app.smartshaadi.co.in/kyc/callback');
  });

  it('returns a UUID-format state', async () => {
    const result = await getDigiLockerAuthUrl('https://app.smartshaadi.co.in/kyc/callback');
    expect(result.state).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes mock=true flag in authUrl', async () => {
    const result = await getDigiLockerAuthUrl('https://app.smartshaadi.co.in/kyc/callback');
    expect(result.authUrl).toContain('mock=true');
  });
});

describe('verifyDigiLockerCallback (mock)', () => {
  it('returns verified=true', async () => {
    const result = await verifyDigiLockerCallback('mock-code-123');
    expect(result.verified).toBe(true);
  });

  it('returns a MOCK-prefixed refId', async () => {
    const result = await verifyDigiLockerCallback('mock-code-123');
    expect(result.refId).toMatch(/^MOCK-\d+$/);
  });

  it('does NOT expose aadhaar number, uid, or name in the result', async () => {
    const result = await verifyDigiLockerCallback('mock-code-123');
    expect(result).not.toHaveProperty('aadhaarNumber');
    expect(result).not.toHaveProperty('aadhaar');
    expect(result).not.toHaveProperty('uid');
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('dob');
  });
});
