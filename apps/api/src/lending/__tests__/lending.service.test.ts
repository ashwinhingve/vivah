/**
 * Lending placement shell (Unit 6.2, Tier 3, MOCK ONLY).
 *
 * Guarantees:
 *  A. Offers are MOCK ONLY until LENDING_LIVE (a mis-flip throws — never a real call).
 *  B. Consent writes a CONSENTED service_referrals row with NO commission booked
 *     and NO bank details; commission stays the only (later) revenue line.
 *  C. Consent is enforced literal-true at the schema boundary (never pre-ticked) —
 *     RBI Digital Lending Directions 2025.
 */
import { describe, it, expect, vi } from 'vitest';
import { RecordLendingConsentSchema } from '@smartshaadi/schemas';

// ── A + B. Service behavior with mocked env + db ─────────────────────────────
const insertValues = vi.fn();

async function loadService(useMockLending: boolean, insertedRow?: Record<string, unknown>) {
  vi.resetModules();
  insertValues.mockClear();
  vi.doMock('../../lib/env.js', () => ({ shouldUseMockLending: useMockLending, env: {} }));
  vi.doMock('../../lib/db.js', () => ({
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          insertValues(v);
          return { returning: async () => [insertedRow ?? mockRow(v)] };
        },
      }),
    },
  }));
  return import('../service.js');
}

function mockRow(v: Record<string, unknown>): Record<string, unknown> {
  const now = new Date('2026-07-18T00:00:00Z');
  return {
    id: 'ref-1', profileId: v['profileId'], kind: 'LENDING', status: 'CONSENTED',
    partnerRef: v['partnerRef'], context: v['context'], contextId: v['contextId'] ?? null,
    consentAt: now, consentVersion: v['consentVersion'],
    principalPaise: v['principalPaise'] ?? null, commissionPaise: null,
    currency: 'INR', mock: v['mock'], metadata: null, createdAt: now, updatedAt: now,
  };
}

describe('Lending offers mock parity', () => {
  it('shouldUseMockLending=true → returns neutral multi-offer as LSP, mock=true', async () => {
    const svc = await loadService(true);
    const result = await svc.getLoanOffers('BOOKING');
    expect(result.isLsp).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.offers.length).toBeGreaterThanOrEqual(2); // neutral multi-offer
    for (const o of result.offers) {
      expect(o.reName).toBeTruthy();     // RE identity disclosed
      expect(o.kfsUrl).toBeTruthy();     // KFS link slot present
      expect(o.mock).toBe(true);
    }
  });

  it('shouldUseMockLending=false → getLoanOffers throws NOT_CONFIGURED (no real call)', async () => {
    const svc = await loadService(false);
    await expect(svc.getLoanOffers('BOOKING')).rejects.toThrow('Live lending partner not configured');
  });
});

describe('Lending consent', () => {
  it('records a CONSENTED referral with a consent version and NO commission booked', async () => {
    const svc = await loadService(true);
    const referral = await svc.recordLendingConsent('p1', { offerRef: 'mock-loan-shubh', context: 'BOOKING' });
    expect(referral.kind).toBe('LENDING');
    expect(referral.status).toBe('CONSENTED');
    expect(referral.consentVersion).toBe(svc.LENDING_CONSENT_VERSION);
    expect(referral.commissionPaise).toBeNull();          // never booked at consent
    expect(referral.principalPaise).toBe('50000000');     // display-only amount
    const written = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(written['commissionPaise']).toBeNull();
    expect(written).not.toHaveProperty('bankAccount');    // no bank details ever stored
  });

  it('rejects an unknown offer in mock mode', async () => {
    const svc = await loadService(true);
    await expect(svc.recordLendingConsent('p1', { offerRef: 'nope', context: 'BOOKING' })).rejects.toThrow('Unknown loan offer');
  });
});

// ── C. Consent schema — no pre-ticked / blank consent ────────────────────────
describe('RecordLendingConsentSchema (RBI 2025 — consent never pre-ticked)', () => {
  it('accepts explicit consent:true', () => {
    expect(RecordLendingConsentSchema.safeParse({ offerRef: 'mock-loan-shubh', consent: true }).success).toBe(true);
  });
  it('rejects consent:false', () => {
    expect(RecordLendingConsentSchema.safeParse({ offerRef: 'mock-loan-shubh', consent: false }).success).toBe(false);
  });
  it('rejects a missing consent field (blank box)', () => {
    expect(RecordLendingConsentSchema.safeParse({ offerRef: 'mock-loan-shubh' }).success).toBe(false);
  });
});
