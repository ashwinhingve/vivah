/**
 * Smart Shaadi — Lending placement service (Unit 6.2, Tier 3, MOCK ONLY)
 *
 * Smart Shaadi is a Loan Service Provider (LSP) under the RBI (Digital Lending)
 * Directions 2025 — NEVER the lender. No money flows through us: disbursal is
 * borrower-direct, repayment RE-direct. Our only revenue line is a referral
 * COMMISSION paid by the regulated entity (RE) — never interest, never a fee
 * collected from the borrower.
 *
 * This tier is MOCK ONLY: no real lender/aggregator call ever ships until a
 * partner + RBI-DLG compliance agreement lands. The mock returns fake offers so
 * the placement + consent UX (built to the 2025 rules) can be verified now; the
 * live swap is credentials-only.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { serviceReferrals } from '@smartshaadi/db';
import { shouldUseMockLending } from '../lib/env.js';
import { toServiceReferral } from '../lib/serviceReferral.js';
import type { LoanOffer, ServiceReferral } from '@smartshaadi/types';

export class LendingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LendingError';
  }
}

/** Consent copy version — bump when the disclosure/consent wording changes. */
export const LENDING_CONSENT_VERSION = 'rbi-dl-2025-v1';

/**
 * Neutral multi-offer mock catalogue. All offers are presented objectively (no
 * steering / dark patterns); each discloses its RE (lender) identity and a KFS
 * link. Amounts are paise strings. These are FAKE — labelled mock=true.
 */
const MOCK_OFFERS: LoanOffer[] = [
  {
    offerRef:         'mock-loan-shubh',
    reName:           'Shubh Finance (RBI-registered NBFC)',
    amountPaise:      '50000000',   // ₹5,00,000
    tenorMonths:      24,
    aprPct:           14.5,
    monthlyPaise:     '2410000',    // ~₹24,100/mo
    penalChargesNote: '2% p.a. on overdue principal — disclosed in the KFS',
    kfsUrl:           'https://smartshaadi.co.in/kfs/mock-shubh',
    mock:             true,
  },
  {
    offerRef:         'mock-loan-sahaj',
    reName:           'Sahaj Bank Ltd (RBI-regulated)',
    amountPaise:      '50000000',
    tenorMonths:      36,
    aprPct:           12.9,
    monthlyPaise:     '1680000',    // ~₹16,800/mo
    penalChargesNote: 'Flat ₹500 per missed EMI — disclosed in the KFS',
    kfsUrl:           'https://smartshaadi.co.in/kfs/mock-sahaj',
    mock:             true,
  },
  {
    offerRef:         'mock-loan-vivaah',
    reName:           'Vivaah Capital (RBI-registered NBFC)',
    amountPaise:      '75000000',   // ₹7,50,000
    tenorMonths:      48,
    aprPct:           15.9,
    monthlyPaise:     '2120000',    // ~₹21,200/mo
    penalChargesNote: '3% p.a. on overdue principal — disclosed in the KFS',
    kfsUrl:           'https://smartshaadi.co.in/kfs/mock-vivaah',
    mock:             true,
  },
];

export interface LoanOffersResult {
  /** Always true — we surface offers as an LSP, never as the lender. */
  isLsp:  true;
  offers: LoanOffer[];
  mock:   boolean;
}

/**
 * Surface loan offers for a planning/booking context. Mocked until LENDING_LIVE.
 * The live branch throws so a mis-flip fails loudly rather than hitting a real
 * lender without a compliant integration.
 */
export async function getLoanOffers(_context: string): Promise<LoanOffersResult> {
  if (shouldUseMockLending) {
    return { isLsp: true, offers: MOCK_OFFERS, mock: true };
  }
  throw new LendingError(
    'NOT_CONFIGURED',
    'Live lending partner not configured (set LENDING_LIVE=true with an NBFC/aggregator agreement + RBI-DLG compliance)',
  );
}

export interface RecordLendingConsentInput {
  offerRef:   string;
  context:    string;
  contextId?: string | null;
}

/**
 * Record a borrower's explicit consent to be referred to an RE. Consent is
 * enforced literal-true at the schema boundary (never pre-ticked). Writes a
 * service_referrals row at status CONSENTED. commission_paise stays NULL — it is
 * recorded only if/when the RE actually pays us, never at consent time, and is
 * always the ONLY money we book. No bank details / KYC are stored here.
 */
export async function recordLendingConsent(
  profileId: string,
  input: RecordLendingConsentInput,
): Promise<ServiceReferral> {
  const offer = MOCK_OFFERS.find((o) => o.offerRef === input.offerRef);
  if (shouldUseMockLending && !offer) {
    throw new LendingError('NOT_FOUND', `Unknown loan offer: ${input.offerRef}`);
  }

  const [row] = await db
    .insert(serviceReferrals)
    .values({
      profileId,
      kind:           'LENDING',
      status:         'CONSENTED',
      partnerRef:     input.offerRef,
      context:        input.context,
      contextId:      input.contextId ?? null,
      consentAt:      new Date(),
      consentVersion: LENDING_CONSENT_VERSION,
      principalPaise: offer ? BigInt(offer.amountPaise) : null,
      commissionPaise: null,
      currency:       'INR',
      mock:           shouldUseMockLending,
    })
    .returning();

  if (!row) throw new LendingError('INSERT_FAILED', 'Could not record lending consent');
  return toServiceReferral(row);
}

/** A profile's own lending referrals (most recent first). */
export async function listLendingReferrals(profileId: string): Promise<ServiceReferral[]> {
  const rows = await db
    .select()
    .from(serviceReferrals)
    .where(and(eq(serviceReferrals.profileId, profileId), eq(serviceReferrals.kind, 'LENDING')))
    .orderBy(desc(serviceReferrals.createdAt))
    .limit(50);
  return rows.map(toServiceReferral);
}
