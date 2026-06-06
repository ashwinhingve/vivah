// packages/types/src/contract.ts
//
// Documentation & e-sign contracts — Phase 5 P0.
// Contract templates → DigiLocker eSign (Signzy fallback) → R2-stored signed PDF
// with a content hash in the audit chain. The ContractDrafter agent (Haiku) only
// picks clauses from an approved library; it never writes free legal text.

import type { ProfileId } from './profile.js'

export const ContractStatus = {
  DRAFT:  'DRAFT',
  SENT:   'SENT',
  SIGNED: 'SIGNED',
  VOID:   'VOID',
} as const
export type ContractStatus = typeof ContractStatus[keyof typeof ContractStatus]

export const ESignProvider = {
  DIGILOCKER: 'DIGILOCKER',
  SIGNZY:     'SIGNZY',
} as const
export type ESignProvider = typeof ESignProvider[keyof typeof ESignProvider]

/** A single contract document and its signing lifecycle. */
export interface Contract {
  id:             string
  profileId:      ProfileId            // signing party's profile (vendor / B2B owner)
  templateId:     string
  title:          string
  status:         ContractStatus
  provider:       ESignProvider | null // null until sent for signature
  signedAssetKey: string | null        // R2 key of the signed PDF
  contentHash:    string | null        // sha256 of signed PDF — audit chain anchor
  sentAt:         string | null
  signedAt:       string | null
  createdAt:      string
  updatedAt:      string
}
