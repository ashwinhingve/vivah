// packages/types/src/money.ts
//
// Shared Money value type — seeded in Phase 5 (Tier 0 contracts) so Phase 7
// multi-currency / NRI does NOT have to retrofit it (see phases-5-8 master plan).
//
// Canonical representation: integer **paise** as bigint + an ISO currency code.
// NEVER float, NEVER decimal-string for new money. Legacy finance.ts columns
// keep their decimal(12,2) rupees — this type is for new Phase 5+ surfaces only.

export const CurrencyCode = {
  INR: 'INR',
  USD: 'USD',
  GBP: 'GBP',
  EUR: 'EUR',
  AED: 'AED',
  CAD: 'CAD',
  AUD: 'AUD',
  SGD: 'SGD',
} as const
export type CurrencyCode = typeof CurrencyCode[keyof typeof CurrencyCode]

/**
 * A money amount as integer minor units (paise for INR) + currency.
 * `paise` is the minor-unit count regardless of currency (cents for USD, etc.).
 */
export interface Money {
  paise: bigint
  currency: CurrencyCode
}

export function makeMoney(paise: bigint, currency: CurrencyCode = 'INR'): Money {
  return { paise, currency }
}

/** INR convenience constructor. */
export function inr(paise: bigint): Money {
  return { paise, currency: 'INR' }
}

export const zeroMoney: Money = { paise: 0n, currency: 'INR' }
