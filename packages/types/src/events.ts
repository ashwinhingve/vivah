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

export const VENDOR_CATEGORIES = [
  'PHOTOGRAPHY',
  'VIDEOGRAPHY',
  'CATERING',
  'DECORATION',
  'VENUE',
  'MAKEUP',
  'JEWELLERY',
  'CLOTHING',
  'MUSIC',
  'LIGHTING',
  'SECURITY',
  'TRANSPORT',
  'PRIEST',
  'SOUND',
  'EVENT_HOSTING',
  'RENTAL',
  'OTHER',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
