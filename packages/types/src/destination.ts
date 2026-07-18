/**
 * Smart Shaadi — Destination wedding contracts
 * packages/types/src/destination.ts
 *
 * Phase 8 Sprint I (Unit 8.1). Mirrors the `wedding_destinations` and
 * `guest_travel_legs` tables added in migration 0036.
 *
 * A "destination" here is a CITY LEG of one wedding — Mehndi in Delhi, Wedding
 * in Udaipur — not a catalogue entry. There is deliberately no package, price or
 * venue-supply shape in this file: destination supply is Tier 3, blocked on
 * venue/vendor partnerships (docs/phase-5-8/PHASE-5-8-ROADMAP.md §4, Phase 8).
 *
 * Dates are `YYYY-MM-DD` strings and times `HH:MM` strings, matching how the API
 * serialises pg `date` / varchar(10) columns elsewhere in this codebase.
 */

/** One city leg of a wedding. Mirrors a `wedding_destinations` row. */
export interface WeddingDestination {
  id:           string;
  weddingId:    string;
  city:         string;
  /** ISO 3166-1 alpha-2, uppercase. Same convention as profiles.country_of_residence. */
  countryCode:  string;
  /** IANA identifier, e.g. 'Asia/Kolkata'. Same convention as profiles.iana_timezone. */
  ianaTimezone: string;
  arriveOn:     string;
  departOn:     string;
  sortOrder:    number;
  /** At most one leg per wedding is primary — enforced by a partial unique index. */
  isPrimary:    boolean;
  notes:        string | null;
  createdAt:    string;
  updatedAt:    string;
}

/**
 * A leg plus the counts the list view needs. Computed in one grouped query
 * rather than N+1 per leg.
 */
export interface DestinationSummary extends WeddingDestination {
  ceremonyCount:   number;
  travellerCount:  number;
}

/**
 * One guest's travel to one leg. INTER-CITY TRAVEL ONLY — accommodation lives on
 * `guests.roomNumber` and venue check-in on `guests.arrivedAt`; neither is
 * restated here. Unique on (destinationId, guestId), so writes are an upsert.
 */
export interface GuestTravelLeg {
  id:            string;
  destinationId: string;
  guestId:       string;
  arrivalDate:   string | null;
  arrivalTime:   string | null;
  departureDate: string | null;
  departureTime: string | null;
  travelNotes:   string | null;
  createdAt:     string;
  updatedAt:     string;
}

/** A travel row joined to the guest's display fields, for the logistics table. */
export interface GuestTravelLegWithGuest extends GuestTravelLeg {
  guestName: string;
  /** BRIDE | GROOM | BOTH, or null when unset. */
  guestSide: string | null;
}

/** A ceremony as shown on a leg's detail page. */
export interface DestinationCeremony {
  id:    string;
  type:  string;
  date:  string | null;
  venue: string | null;
  /**
   * True when `date` falls outside the leg's arriveOn..departOn window. A SOFT
   * warning surfaced in the UI, never a validation error — planners legitimately
   * hold placeholder dates while they are still booking.
   */
  outsideWindow: boolean;
}

/** Detail payload for one leg. */
export interface DestinationDetail {
  destination: WeddingDestination;
  ceremonies:  DestinationCeremony[];
  travel:      GuestTravelLegWithGuest[];
}

/** Result of deleting a leg — ceremonies detach rather than being deleted. */
export interface DestinationDeleteResult {
  id: string;
  /** How many ceremonies were detached (destination_id set to NULL). */
  detachedCeremonies: number;
}
