// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set KYC_LIVE=true in .env once DigiLocker API approval arrives, then
// implement the two TODO blocks below using the official SDK. KYC stays mocked
// while USE_MOCK_SERVICES flips off at payment-launch — only KYC_LIVE flips it real.
// No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { shouldUseMockKyc } from '../lib/env.js';

export interface DigiLockerAuthUrl {
  authUrl: string;
  state:   string;
}

export interface DigiLockerVerifyResult {
  verified: boolean;
  refId:    string;
  // Aadhaar number intentionally omitted — never expose, never persist
}

export async function getDigiLockerAuthUrl(redirectUri: string): Promise<DigiLockerAuthUrl> {
  if (!shouldUseMockKyc) {
    // TODO: import DigiLocker SDK and call getAuthUrl(redirectUri, scopes)
    throw new Error('Real DigiLocker client not yet configured');
  }

  const state = randomUUID();
  return {
    authUrl: `${redirectUri}?state=${state}&mock=true`,
    state,
  };
}

export async function verifyDigiLockerCallback(_code: string): Promise<DigiLockerVerifyResult> {
  if (!shouldUseMockKyc) {
    // TODO: exchange code for token, pull Aadhaar XML, extract name + DOB,
    //       confirm identity, then discard all PII. Return only refId.
    throw new Error('Real DigiLocker client not yet configured');
  }

  return {
    verified: true,
    refId:    `MOCK-${Date.now()}`,
  };
}
