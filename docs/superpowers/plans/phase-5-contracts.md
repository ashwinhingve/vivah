# Phase 5 — Tier 0 Contracts (shared foundation)

> Status: **landed** on branch `feat/50-contracts`. Migration `0028` generated +
> idempotent, **NOT applied to prod**. No feature code in this tier.

This tier defines only the shared contracts every Phase 5 feature builds on:
TypeScript types, Zod schemas, Drizzle tables, one migration. Business logic
(routers, services, UI) lands in the later build tiers that consume these.

---

## New tables (migration `0028_sturdy_next_avengers.sql`)

| Table | Feature | Money? | Key indexes |
|-------|---------|--------|-------------|
| `vendor_capacity` | Vendor Utilization Engine | — | `(profile_id, status, created_at)`, `(start_at, end_at)` |
| `pricing_rules` | Dynamic Pricing v1 | `base_paise bigint` + `currency` | `(profile_id, status, created_at)` |
| `calendar_events` | Calendar Intelligence | — | `(kind, event_date)`, `(event_date)` |
| `b2b_accounts` | B2B self-serve | — | `(profile_id, status)`, unique `(gstin)` |
| `contracts` | Documentation & e-sign | — | `(profile_id, status, created_at)` |

New enums: `money_currency`, `capacity_status`, `pricing_rule_status`,
`calendar_event_kind`, `auspicious_band`, `b2b_account_status`,
`contract_status`, `esign_provider`.

**`vendor_leads` is intentionally NOT in this migration** — it already exists
(migration `0022` + `schema/index.ts`). The VUE *reads* it; Tier 0 does not touch
it. Any VUE scoring columns land in the VUE build tier.

---

## ProfileId boundary (non-negotiable)

Every profile-keyed FK references `profiles.id` (UUID), `ON DELETE CASCADE` —
**never** the Better Auth `user.id` (text). In TypeScript every such field is the
branded `ProfileId` (`packages/types/src/profile.ts` → `asProfileId()`), never a
raw `string`.

- Resolve `userId → profileId` (`apps/api/src/lib/profile.ts`) before any query
  against these tables.
- **Zod boundary:** the Zod schemas validate `profileId` as a raw
  `z.string().uuid()`. The `ProfileId` brand is applied at the resolver/router
  boundary via `asProfileId()` — NOT inside the schema. (Branding inside an
  exported Zod schema breaks `.d.ts` emit: TS4023, the private brand symbol can't
  be named across packages.)

## Money rule

New money is **integer paise in a `bigint` column** (`mode: 'bigint'`) + a
`money_currency` enum, surfaced in TS as the `Money` value type
(`packages/types/src/money.ts`: `{ paise: bigint; currency: CurrencyCode }`).
Never float/decimal for new money. Legacy `finance.ts` columns keep their
`decimal(12,2)` rupees — do not migrate them here. This seeds the Phase 7
multi-currency `Money` type early instead of retrofitting it.

---

## File-ownership map (for the later build agents)

Each build tier owns its feature code but **must not redefine these contracts** —
import them.

| Build agent | Owns (later) | Consumes these contracts |
|-------------|--------------|--------------------------|
| **VUE** | `apps/api/src/vue/*`, ranking service, UI | types `vue.ts` + `money.ts`; schema `vue.ts`; tables `vendor_capacity`, `vendor_leads` (existing) |
| **Calendar** | `apps/api/src/calendar/*`, CalendarOracle, muhurat seed | types/schema `calendar.ts`; table `calendar_events` |
| **Pricing** | `apps/api/src/pricing/*`, PricingAdvisor service, vendor UI | types/schema `pricing.ts` + `money.ts`; table `pricing_rules`; **ADR-001** |
| **B2B** | `apps/api/src/b2b/*`, quote→proforma→invoice, B2BConcierge | types/schema `b2b.ts` + `money.ts`; table `b2b_accounts` |
| **Contracts** | `apps/api/src/contracts/*`, ContractDrafter, eSign integration | types/schema `contract.ts`; table `contracts` |

Contract files (do not duplicate):
- Types: `packages/types/src/{money,vue,calendar,pricing,b2b,contract}.ts`
  (re-exported from `packages/types/src/index.ts`).
- Schemas: `packages/schemas/src/{money,vue,calendar,pricing,b2b,contract}.ts`
  (re-exported from `packages/schemas/src/index.ts`).
- Tables: `packages/db/schema/phase5.ts` (re-exported from `schema/index.ts`).

---

## Apply checklist (when Phase 5 is greenlit — NOT now)

Follow the Production DB Migration Protocol in `CLAUDE.md` (run from Windows
PowerShell; backup first; additive-only). `0028` is additive: 5 `CREATE TABLE IF
NOT EXISTS`, 8 guarded `CREATE TYPE`, FK + index guards — safe to re-run.
