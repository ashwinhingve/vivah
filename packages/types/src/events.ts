export const EVENT_TYPES = [
  'WEDDING',
  'HALDI',
  'MEHNDI',
  'SANGEET',
  'ENGAGEMENT',
  'RECEPTION',
  'CORPORATE',
  'FESTIVAL',
  'COMMUNITY',
  'COMMUNITY_EVENT',
  'GOVERNMENT',
  'SCHOOL',
  'OTHER',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Vendor categories are defined in vendor.ts (single source of truth) and
// re-exported from index.ts. The duplicate here used to collide and break
// `tsc` (TS2308) at the package's barrel export.
