/**
 * ISO 3166-1 alpha-2 country codes and names.
 * Used for NRI profile country selection and display.
 */

export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'JP', name: 'Japan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
];

/**
 * Map of country codes to country names for easy lookup.
 */
export const COUNTRY_BY_CODE = Object.fromEntries(
  COUNTRIES.map(c => [c.code, c.name])
);

/**
 * Get the country name for a given ISO 3166-1 alpha-2 code.
 */
export function getCountryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_BY_CODE[code.toUpperCase()] ?? null;
}
