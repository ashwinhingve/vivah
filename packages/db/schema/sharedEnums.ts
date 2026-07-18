/**
 * Smart Shaadi — shared pg enums
 * packages/db/schema/sharedEnums.ts
 *
 * LEAF MODULE — imports nothing but drizzle. Do not add an import of `./index`
 * or any phase file here.
 *
 * Why this file exists: `schema/index.ts` and `schema/phase5.ts` form an ES
 * module cycle (phase5 imports `profiles` from index; index re-exports phase5).
 * That cycle is only safe because neither module's *body* reads a binding from
 * the other — phase5 uses `profiles` lazily inside `() => profiles` callbacks.
 * The moment a module body needs a `const` from the other side of the cycle,
 * evaluation order decides whether you get the value or a TDZ ReferenceError.
 *
 * `money_currency` is needed by a table body in index.ts (profiles.display_currency,
 * Sprint G) AND by table bodies in phase5/phase6. Keeping it in a leaf that both
 * sides import makes the order irrelevant.
 *
 * This declares the same PG type name (`money_currency`) it always had — it is a
 * pure code move, not a schema change. No migration is emitted for it.
 */

import { pgEnum } from 'drizzle-orm/pg-core';

export const moneyCurrencyEnum = pgEnum('money_currency', [
  'INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD',
]);
