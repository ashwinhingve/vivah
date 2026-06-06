// packages/types/src/b2b.ts
//
// B2B self-serve contracts — Phase 5 P1.
// GSTIN signup (GSTN mocked until registration), quote → proforma → GST invoice.
// This file is the account shape only; quote/invoice flows land in a later tier.

import type { ProfileId } from './profile.js'

export const B2BAccountStatus = {
  PENDING:   'PENDING',
  VERIFIED:  'VERIFIED',
  REJECTED:  'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const
export type B2BAccountStatus = typeof B2BAccountStatus[keyof typeof B2BAccountStatus]

/** A registered business/institutional buyer account. */
export interface B2BAccount {
  id:             string
  profileId:      ProfileId      // owner profile (profiles.id)
  legalName:      string
  gstin:          string         // 15-char GSTIN
  hsnSac:         string | null  // default HSN/SAC for invoicing
  billingAddress: string | null
  contactEmail:   string | null
  contactPhone:   string | null
  status:         B2BAccountStatus
  createdAt:      string
  updatedAt:      string
}
