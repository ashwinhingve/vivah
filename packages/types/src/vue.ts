// packages/types/src/vue.ts
//
// Vendor Utilization Engine (VUE) contracts — Phase 5 P0.
// Capacity windows are STORED (vendor_capacity table); the utilization lead
// ranking is COMPUTED by the VUE service (built in a later tier) and not
// persisted here.

import type { ProfileId } from './profile.js'

export const CapacityStatus = {
  OPEN: 'OPEN',         // available for booking
  HELD: 'HELD',         // tentatively held
  BOOKED: 'BOOKED',     // filled
  BLOCKED: 'BLOCKED',   // vendor blackout
} as const
export type CapacityStatus = typeof CapacityStatus[keyof typeof CapacityStatus]

/** A bookable (or blocked) time window for a vendor's capacity. */
export interface VendorCapacityWindow {
  id:           string
  profileId:    ProfileId     // the vendor's profile (profiles.id)
  startAt:      string        // ISO timestamp
  endAt:        string        // ISO timestamp
  status:       CapacityStatus
  maxBookings:  number        // concurrent capacity for this window
  bookedCount:  number
  offSeason:    boolean       // true when window falls outside peak muhurat season
  notes:        string | null
  createdAt:    string
  updatedAt:    string
}

/**
 * Output of the VUE ranking service: an off-season lead routed to a vendor,
 * scored by expected margin. Computed, never stored in Tier 0.
 */
export interface VendorUtilizationLead {
  profileId:            ProfileId   // vendor receiving the lead
  leadId:               string      // references the existing vendor_leads row
  expectedMarginPaise:  bigint
  utilizationScore:     number      // 0..1, higher = better fit for idle capacity
  reason:               string
}
