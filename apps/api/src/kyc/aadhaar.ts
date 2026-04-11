// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set USE_MOCK_SERVICES=false in .env once DigiLocker API approval
// arrives, then implement the two TODO blocks below using the official SDK.
// No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { env } from '../lib/env.js';

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
  if (!env.USE_MOCK_SERVICES) {
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
  if (!env.USE_MOCK_SERVICES) {
    // TODO: exchange code for token, pull Aadhaar XML, extract name + DOB,
    //       confirm identity, then discard all PII. Return only refId.
    throw new Error('Real DigiLocker client not yet configured');
  }

  return {
    verified: true,
    refId:    `MOCK-${Date.now()}`,
  };
}
