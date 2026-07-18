/**
 * Insurance placement shell (Unit 6.3, Tier 3, MOCK ONLY).
 *
 * Guarantees:
 *  A. Quotes are MOCK ONLY until INSURANCE_LIVE (a mis-flip throws — never a real call).
 *  B. HEALTH is the lead SKU (Colonel product decision; wedding cover is niche).
 *  C. Consent writes a CONSENTED referral with NO commission booked (premium is
 *     never our revenue line) and is enforced literal-true (never pre-ticked) — IRDAI.
 */
import { describe, it, expect, vi } from 'vitest';
import { RecordInsuranceConsentSchema } from '@smartshaadi/schemas';

const insertValues = vi.fn();

async function loadService(useMockInsurance: boolean) {
  vi.resetModules();
  insertValues.mockClear();
  vi.doMock('../../lib/env.js', () => ({ shouldUseMockInsurance: useMockInsurance, env: {} }));
  vi.doMock('../../lib/db.js', () => ({
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          insertValues(v);
          return { returning: async () => [mockRow(v)] };
        },
      }),
    },
  }));
  return import('../service.js');
}

function mockRow(v: Record<string, unknown>): Record<string, unknown> {
  const now = new Date('2026-07-18T00:00:00Z');
  return {
    id: 'ref-1', profileId: v['profileId'], kind: 'INSURANCE', status: 'CONSENTED',
    partnerRef: v['partnerRef'], context: v['context'], contextId: v['contextId'] ?? null,
    consentAt: now, consentVersion: v['consentVersion'],
    principalPaise: v['principalPaise'] ?? null, commissionPaise: null,
    currency: 'INR', mock: v['mock'], metadata: v['metadata'] ?? null, createdAt: now, updatedAt: now,
  };
}

describe('Insurance quotes mock parity', () => {
  it('shouldUseMockInsurance=true → HEALTH-led quotes, insurer identity + grievance disclosed', async () => {
    const svc = await loadService(true);
    const result = await svc.getInsuranceQuotes('BOOKING');
    expect(result.mock).toBe(true);
    expect(result.leadSku).toBe('HEALTH');
    expect(result.quotes[0]!.sku).toBe('HEALTH');   // lead first
    expect(result.quotes[0]!.lead).toBe(true);
    for (const q of result.quotes) {
      expect(q.insurerName).toBeTruthy();            // insurer identity slot
      expect(q.insurerGrievanceUrl).toBeTruthy();    // grievance path
      expect(q.mock).toBe(true);
    }
  });

  it('shouldUseMockInsurance=false → getInsuranceQuotes throws NOT_CONFIGURED', async () => {
    const svc = await loadService(false);
    await expect(svc.getInsuranceQuotes('BOOKING')).rejects.toThrow('Live insurance partner not configured');
  });
});

describe('Insurance consent', () => {
  it('records a CONSENTED referral with NO commission and the sum-assured as display-only', async () => {
    const svc = await loadService(true);
    const referral = await svc.recordInsuranceConsent('p1', { quoteRef: 'mock-ins-health', sku: 'HEALTH', context: 'BOOKING' });
    expect(referral.kind).toBe('INSURANCE');
    expect(referral.status).toBe('CONSENTED');
    expect(referral.consentVersion).toBe(svc.INSURANCE_CONSENT_VERSION);
    expect(referral.commissionPaise).toBeNull();       // premium is never our revenue line
    expect(referral.principalPaise).toBe('50000000');  // sum assured, display only
    const written = insertValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(written['commissionPaise']).toBeNull();
  });

  it('rejects an unknown quote in mock mode', async () => {
    const svc = await loadService(true);
    await expect(svc.recordInsuranceConsent('p1', { quoteRef: 'nope', sku: 'HEALTH', context: 'BOOKING' })).rejects.toThrow('Unknown insurance quote');
  });
});

describe('RecordInsuranceConsentSchema (IRDAI — consent never pre-ticked)', () => {
  it('accepts explicit consent:true', () => {
    expect(RecordInsuranceConsentSchema.safeParse({ quoteRef: 'mock-ins-health', sku: 'HEALTH', consent: true }).success).toBe(true);
  });
  it('rejects consent:false and a missing consent field', () => {
    expect(RecordInsuranceConsentSchema.safeParse({ quoteRef: 'mock-ins-health', sku: 'HEALTH', consent: false }).success).toBe(false);
    expect(RecordInsuranceConsentSchema.safeParse({ quoteRef: 'mock-ins-health', sku: 'HEALTH' }).success).toBe(false);
  });
});
