/**
 * Smart Shaadi — Insurance placement service (Unit 6.3, Tier 3, MOCK ONLY)
 *
 * Smart Shaadi surfaces insurer quotes as a referrer — our only revenue line is
 * a referral COMMISSION paid by the insurer/aggregator, NEVER the premium. We
 * lead with a standard SKU (HEALTH — a Colonel product decision; wedding-event
 * cover is niche/secondary). IRDAI disclosure requires a clear insurer-identity
 * slot, no pre-ticked consent, and a grievance path.
 *
 * MOCK ONLY: no real insurer/aggregator call ships until INSURANCE_LIVE + an
 * IRDAI-compliant agreement lands. The live swap is credentials-only.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { serviceReferrals } from '@smartshaadi/db';
import { shouldUseMockInsurance } from '../lib/env.js';
import { toServiceReferral } from '../lib/serviceReferral.js';
import type { InsuranceQuote, InsuranceSku, ServiceReferral } from '@smartshaadi/types';

export class InsuranceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InsuranceError';
  }
}

/** Consent copy version — bump when the disclosure/consent wording changes. */
export const INSURANCE_CONSENT_VERSION = 'irdai-2026-v1';

/**
 * Mock quote catalogue. HEALTH is the lead SKU; LIFE / TRAVEL are secondary;
 * WEDDING is niche. Each discloses the insurer identity + a grievance URL.
 * Amounts are paise strings. These are FAKE — labelled mock=true.
 */
const MOCK_QUOTES: InsuranceQuote[] = [
  {
    quoteRef:            'mock-ins-health',
    insurerName:         'Suraksha Health Insurance Co. Ltd (IRDAI-registered)',
    sku:                 'HEALTH',
    sumAssuredPaise:     '50000000',      // ₹5,00,000 cover
    premiumPaise:        '1200000',       // ~₹12,000/yr
    insurerGrievanceUrl: 'https://smartshaadi.co.in/grievance/mock-suraksha',
    lead:                true,
    mock:                true,
  },
  {
    quoteRef:            'mock-ins-life',
    insurerName:         'Sahara Life Insurance Co. Ltd (IRDAI-registered)',
    sku:                 'LIFE',
    sumAssuredPaise:     '1000000000',    // ₹1,00,00,000 (1 crore) term cover
    premiumPaise:        '900000',        // ~₹9,000/yr
    insurerGrievanceUrl: 'https://smartshaadi.co.in/grievance/mock-sahara',
    lead:                false,
    mock:                true,
  },
  {
    quoteRef:            'mock-ins-travel',
    insurerName:         'Yatra General Insurance Ltd (IRDAI-registered)',
    sku:                 'TRAVEL',
    sumAssuredPaise:     '200000000',     // ₹20,00,000 trip cover
    premiumPaise:        '150000',        // ~₹1,500/trip
    insurerGrievanceUrl: 'https://smartshaadi.co.in/grievance/mock-yatra',
    lead:                false,
    mock:                true,
  },
  {
    quoteRef:            'mock-ins-wedding',
    insurerName:         'Shaadi Shield (IRDAI-registered)',
    sku:                 'WEDDING',
    sumAssuredPaise:     '500000000',     // ₹50,00,000 event cover — niche
    premiumPaise:        '2500000',       // ~₹25,000
    insurerGrievanceUrl: 'https://smartshaadi.co.in/grievance/mock-shield',
    lead:                false,
    mock:                true,
  },
];

export interface InsuranceQuotesResult {
  quotes: InsuranceQuote[];
  /** The lead SKU we present first (Colonel product decision). */
  leadSku: InsuranceSku;
  mock:   boolean;
}

/**
 * Surface insurer quotes for a booking context, HEALTH-led. Mocked until
 * INSURANCE_LIVE; the live branch throws so a mis-flip fails loudly.
 */
export async function getInsuranceQuotes(_context: string): Promise<InsuranceQuotesResult> {
  if (shouldUseMockInsurance) {
    // Lead SKU first, then the rest in catalogue order.
    const quotes = [...MOCK_QUOTES].sort((a, b) => Number(b.lead) - Number(a.lead));
    return { quotes, leadSku: 'HEALTH', mock: true };
  }
  throw new InsuranceError(
    'NOT_CONFIGURED',
    'Live insurance partner not configured (set INSURANCE_LIVE=true with an IRDAI-compliant aggregator agreement)',
  );
}

export interface RecordInsuranceConsentInput {
  quoteRef:   string;
  sku:        InsuranceSku;
  context:    string;
  contextId?: string | null;
}

/**
 * Record explicit consent to be referred to an insurer. Consent is enforced
 * literal-true at the schema boundary (never pre-ticked). Writes a
 * service_referrals row at status CONSENTED. principal_paise carries the
 * sum-assured (display only); commission_paise stays NULL — premium is never
 * our revenue line and is never stored as such.
 */
export async function recordInsuranceConsent(
  profileId: string,
  input: RecordInsuranceConsentInput,
): Promise<ServiceReferral> {
  const quote = MOCK_QUOTES.find((q) => q.quoteRef === input.quoteRef);
  if (shouldUseMockInsurance && !quote) {
    throw new InsuranceError('NOT_FOUND', `Unknown insurance quote: ${input.quoteRef}`);
  }

  const [row] = await db
    .insert(serviceReferrals)
    .values({
      profileId,
      kind:           'INSURANCE',
      status:         'CONSENTED',
      partnerRef:     input.quoteRef,
      context:        input.context,
      contextId:      input.contextId ?? null,
      consentAt:      new Date(),
      consentVersion: INSURANCE_CONSENT_VERSION,
      principalPaise: quote ? BigInt(quote.sumAssuredPaise) : null,
      commissionPaise: null,
      currency:       'INR',
      mock:           shouldUseMockInsurance,
      metadata:       { sku: input.sku },
    })
    .returning();

  if (!row) throw new InsuranceError('INSERT_FAILED', 'Could not record insurance consent');
  return toServiceReferral(row);
}

/** A profile's own insurance referrals (most recent first). */
export async function listInsuranceReferrals(profileId: string): Promise<ServiceReferral[]> {
  const rows = await db
    .select()
    .from(serviceReferrals)
    .where(and(eq(serviceReferrals.profileId, profileId), eq(serviceReferrals.kind, 'INSURANCE')))
    .orderBy(desc(serviceReferrals.createdAt))
    .limit(50);
  return rows.map(toServiceReferral);
}
