// packages/types/src/finance-referral.ts
//
// Phase 6 (Tier 2/3) contracts — shared service-referral commission model for
// the lending (6.2) and insurance (6.3) placement shells, plus WhatsApp (6.1)
// send types. All shells are FLAGGED + MOCKED; these are the storage/transport
// shapes only.
//
// COMPLIANCE: commission is the ONLY revenue line. No interest, premium, bank
// details, Aadhaar, or contacts. Smart Shaadi is an LSP (RBI Digital Lending
// Directions 2025), never the lender — no money flows through us.

// ── Shared referral model ────────────────────────────────────────────────────

export const ServiceReferralKind = {
  LENDING:   'LENDING',
  INSURANCE: 'INSURANCE',
} as const
export type ServiceReferralKind = typeof ServiceReferralKind[keyof typeof ServiceReferralKind]

export const ServiceReferralStatus = {
  SURFACED:     'SURFACED',
  CONSENTED:    'CONSENTED',
  SUBMITTED:    'SUBMITTED',
  FULFILLED:    'FULFILLED',     // lending: disbursal · insurance: policy issued
  COMMISSIONED: 'COMMISSIONED',
  DECLINED:     'DECLINED',
  EXPIRED:      'EXPIRED',
} as const
export type ServiceReferralStatus = typeof ServiceReferralStatus[keyof typeof ServiceReferralStatus]

/** A single service_referrals row as returned by the API. */
export interface ServiceReferral {
  id:              string
  profileId:       string
  kind:            ServiceReferralKind
  status:          ServiceReferralStatus
  partnerRef:      string | null
  context:         string                          // BOOKING | PLANNING | ...
  contextId:       string | null
  consentAt:       string | null
  consentVersion:  string | null
  principalPaise:  string | null                   // bigint serialized as string; display only
  commissionPaise: string | null                   // the only revenue line
  currency:        string
  mock:            boolean
  metadata:        Record<string, unknown> | null
  createdAt:       string
  updatedAt:       string
}

// ── Lending (6.2) — RBI Directions 2025: LSP, neutral multi-offer, KFS ───────

/** One lender offer in a neutral multi-offer display. Amounts are paise strings. */
export interface LoanOffer {
  offerRef:        string
  reName:          string                          // regulated entity (lender) name — disclosed
  amountPaise:     string
  tenorMonths:     number
  aprPct:          number                          // annualised, disclosed pre-agreement
  monthlyPaise:    string
  penalChargesNote: string
  kfsUrl:          string                          // Key Fact Statement link (placeholder in mock)
  mock:            boolean
}

// ── Insurance (6.3) — IRDAI disclosure: insurer identity + grievance path ────

export const InsuranceSku = {
  HEALTH:  'HEALTH',      // lead SKU (Colonel product decision — see roadmap)
  LIFE:    'LIFE',
  TRAVEL:  'TRAVEL',
  WEDDING: 'WEDDING',     // niche / secondary
} as const
export type InsuranceSku = typeof InsuranceSku[keyof typeof InsuranceSku]

/** One insurer quote. sumAssured/premium are paise strings, display only. */
export interface InsuranceQuote {
  quoteRef:           string
  insurerName:        string                       // disclosed insurer identity
  sku:                InsuranceSku
  sumAssuredPaise:    string
  premiumPaise:       string                       // display only — never our revenue line
  insurerGrievanceUrl: string                      // IRDAI grievance path (placeholder in mock)
  lead:               boolean                       // true for the hero SKU (health)
  mock:               boolean
}

// ── WhatsApp (6.1) ───────────────────────────────────────────────────────────

export const WhatsAppTemplateName = {
  BOOKING_CONFIRMATION: 'BOOKING_CONFIRMATION',
  BOOKING_REMINDER:     'BOOKING_REMINDER',
} as const
export type WhatsAppTemplateName = typeof WhatsAppTemplateName[keyof typeof WhatsAppTemplateName]

export interface WhatsAppSendResult {
  id:          string                              // whatsapp_messages row id
  status:      'QUEUED' | 'SENT' | 'FAILED' | 'MOCKED'
  providerRef: string | null
  mock:        boolean
}
