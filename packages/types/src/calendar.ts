// packages/types/src/calendar.ts
//
// Calendar Intelligence contracts — Phase 5 P0.
// Fuses muhurat + festival + school + govt calendars. Muhurat dates are
// deterministic (cross-checked vs Drik Panchang); this contract is the storage
// shape only — the CalendarOracle service (later tier) reads/overlays them.

export const CalendarEventKind = {
  MUHURAT:  'MUHURAT',
  FESTIVAL: 'FESTIVAL',
  SCHOOL:   'SCHOOL',    // school-holiday windows (affect guest availability)
  GOVT:     'GOVT',      // public / govt holidays
  REGIONAL: 'REGIONAL',
  BLACKOUT: 'BLACKOUT',  // inauspicious window (e.g. Chaturmas)
} as const
export type CalendarEventKind = typeof CalendarEventKind[keyof typeof CalendarEventKind]

export const AuspiciousBand = {
  NONE:   'NONE',
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
  PEAK:   'PEAK',
} as const
export type AuspiciousBand = typeof AuspiciousBand[keyof typeof AuspiciousBand]

/** A single calendar overlay entry (one date or date-range). */
export interface CalendarEvent {
  id:             string
  kind:           CalendarEventKind
  name:           string
  eventDate:      string                          // YYYY-MM-DD (inclusive start)
  endDate:        string | null                   // YYYY-MM-DD, null = single day
  region:         string | null                   // null = national
  source:         string                          // 'DrikPanchang' | 'GOI' | ...
  auspiciousBand: AuspiciousBand
  metadata:       Record<string, unknown> | null  // tithi/nakshatra etc.
  createdAt:      string
}
