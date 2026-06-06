import { z } from 'zod';

// Mirrors @smartshaadi/types money.ts. Paise as bigint (coerced at I/O edges),
// currency as an ISO code. Never float, never decimal for new money.

export const CURRENCY_CODES = ['INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD'] as const;

export const CurrencyCodeSchema = z.enum(CURRENCY_CODES);

export const MoneySchema = z.object({
  paise:    z.coerce.bigint(),
  currency: CurrencyCodeSchema.default('INR'),
});

export type MoneyInput = z.infer<typeof MoneySchema>;
