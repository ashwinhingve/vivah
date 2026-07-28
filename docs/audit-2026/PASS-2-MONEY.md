# Smart Shaadi — Audit PASS 2: Money Correctness

> **READ-ONLY pass. Nothing was fixed, no schema was touched, no migration was
> generated, no test was run.** This document records where money can go wrong in
> the code as it stands. Each finding is evidence-backed (`file:line`) and carries
> a severity. A remediation direction may be sketched, but every fix is
> **deferred** until a fix pass is explicitly authorised. Ground-truth inventory:
> `PASS-0-INVENTORY.md`; architecture rules: `PASS-3-ARCHITECTURE.md`.

- **Date:** 2026-07-27
- **Scope:** every money path across `apps/**` + `packages/**` — the paise↔rupee
  boundary, float contamination, rounding, currency display, PDF generation, and
  payment/refund/escrow idempotency.
- **Method:** direct file reads of the schema, all five PDF generators, and all
  four money-formatter utilities, plus three parallel evidence agents
  (boundary/float · rounding/idempotency · display/PDF). **Every agent-sourced
  claim was re-graded by hand** before it entered this report — the agents located
  the right files but systematically mislabelled float rounding as "100×", and
  both missed the single highest-impact customer-facing defect (§1.1), which
  firsthand verification surfaced.

**Severity scale** (same as PASS-1/PASS-3)
- **P0** — active breakage / data-loss / money mis-transfer happening now.
- **P1** — latent break that can take a money flow wrong with no code change on our
  side (data-/retry-/deploy-triggered), or a silent-correctness money hazard on a
  live customer path.
- **P2** — correctness/robustness gap with bounded blast radius; cleanup.
- **OBS** — observation / rule-vs-reality note; not a defect.

---

## Headline

The codebase mixes two money representations that type-check identically but
differ by 100×:

- **Legacy RUPEES** — `decimal(12,2)` decimal strings. This is the **entire live
  transactional chain**: `bookings.total_amount`, `payments.amount`,
  `escrow_accounts.total_held`, `booking_addons.unit_price`, `orders`, `rentals`,
  and all of `finance.ts` (invoices, refunds, payouts, wallets, promos, splits,
  plans, subscription charges).
- **PAISE island** — `bigint(_paise)` + `money_currency` enum (ADR-001). Its real
  extent is **small**: `pricing_rules.base_paise` (Dynamic Pricing v1) and the
  phase-6 financial-referral shells (`phase6.ts:63-64`, explicitly *"DISPLAY
  ONLY"*). **Phase 8 deliberately uses rupees** (`phase8.ts:60-66`) so premium
  packages flow straight into `bookings`/`booking_addons` with no conversion.

**The brief's central fear — a paise value silently written as rupees somewhere in
the money-movement chain — does NOT manifest server-side.** Internal storage is
uniformly rupees; paise touches the money path in exactly one place, the Razorpay
integration edge, through the single converter `lib/money.ts` `rupeesToPaise` —
which is itself the documented fix for a **real 2026-05-04 production 100×
incident** (`lib/money.ts:1-9`). The pricing "paise island" is advisory/display
only and, verified by grep, is **never** consumed by a booking or payment write.

**But the same class of bug is live on the client.** The mobile app renders every
subscription price **100× too low** (a ₹499 plan shows as ₹5), and its test masks
the defect by mocking the wrong unit. That, a ₹-glyph black box on the customer tax
invoice, and non-idempotent Razorpay retries are the three P1s.

### Verdict summary

| § | Area | Verdict | Top severity |
|---|---|---|---|
| 1 | Boundary / unit correctness | Server SAFE · **mobile plan price 100× low** | **P1** |
| 2 | Float contamination | Guard is exact · typing is convention-only | P1-OBS / P2 |
| 3 | Rounding | Defined & correct everywhere · coverage + duplication gaps | P2 |
| 4 | Display / PDF | **₹ black box on live booking invoice** | **P1** |
| 5 | Idempotency | Ledgers/CAS SAFE · **retries not idempotent** | **P1** |

### Findings index

| ID | Sev | Finding | First place to look |
|---|---|---|---|
| **A2-01** | **P1** | Mobile shows subscription prices 100× too low (rupee value ÷100) | `apps/mobile/src/app/(app)/billing.tsx:158` |
| **A2-02** | **P1** | ₹ glyph → black box on the customer TAX INVOICE PDF | `apps/api/src/bookings/invoice.ts:19-21` |
| **A2-03** | **P1** | Razorpay `withRetry` is not idempotent (no idempotency key) | `apps/api/src/lib/razorpay.ts:52,174,196,115` |
| A2-04 | P2 | Wallet denormalised balance: float read-modify-write, no row lock | `apps/api/src/payments/wallet.ts:58-64,114-120` |
| A2-05 | P2 | Wallet topup dedup TOCTOU + `Math.round(paise/100)` whole-rupee credit | `apps/api/src/payments/wallet.ts:208-214`; `webhook.ts:146` |
| A2-06 | P2 | GST `computeTax` untested + a second GST impl that can diverge | `apps/api/src/payments/invoiceService.ts:63-71`; `b2b/invoice-pdf.ts:56-59` |
| A2-07 | P2 | PDF `formatRupees` has no lakh/crore grouping | `apps/api/src/lib/pdf/format.ts:15-17` |
| A2-08 | P2 | Web currency util diverges from API for CAD/AUD/SGD | `apps/web/src/lib/currency.ts:41-43` |
| A2-09 | OBS | No type-level paise/rupee distinction — the 100× guard is convention only | `apps/api/src/lib/money.ts` |
| A2-10 | OBS | Shared paise formatters are dead code; ÷100 re-implemented per-component | `apps/api/src/lib/currency.ts`; `apps/web/src/lib/currency.ts` |

---

## §1 — Boundary Map (paise ↔ rupee junctions)

### 1.0 The map (verified)

| Junction | Unit(s) | Conversion | Verdict |
|---|---|---|---|
| Booking → payment → escrow → payout → refund → invoice → wallet | **rupees** throughout | none needed (all rupees) | **SAFE** |
| Any internal value → **Razorpay API** | rupees → **paise** | `rupeesToPaise()` at the edge only (`service.ts:101`, `payouts.ts:95`, `refunds.ts:238`) | **SAFE** (guarded) |
| Dynamic Pricing suggestion | paise in / paise out (`advisor.service.ts:126`) | stays paise; **never written to a booking** (grep-confirmed) | **SAFE** (isolated) |
| Phase-6 lending/insurance shells | `principal_paise`, `commission_paise` (`phase6.ts:63-64`) | *DISPLAY ONLY*, mock-shell features | **SAFE** (isolated) |
| Phase-8 premium packages / post-marriage | **rupees** by design (`phase8.ts:60-66`) | none — flows into `bookings` as rupees | **SAFE** |
| **API `listPlans` (rupees) → mobile billing screen** | rupees → **÷100 in error** | `formatINR(plan.amount / 100)` | **P1 — A2-01** |

The server-side money-movement chain has **no unguarded paise↔rupee write path**.
The one converter that bridges the units, `lib/money.ts`, is confined to the
Razorpay edge and exists precisely because unit confusion once mis-transferred
100× amounts in production (`lib/money.ts:1-9`, "P0 audit, 2026-05-04"). The paise
island (pricing, phase-6) is advisory/display and — confirmed by grep across
`bookings/` and `payments/` — is never consumed on a money-movement path.

### 1.1 — A2-01 · P1 (CONFIRMED) — Mobile renders subscription prices 100× too low

**What.** A ₹499/month plan displays as **"₹5"** on the mobile billing screen.

**Evidence.**
- The API returns plan amounts in **rupees**: `apps/api/src/payments/subscriptions.ts:73-80`
  — `listPlans` selects `plans.amount` (a `decimal(12,2)` column, `finance.ts:388`)
  and returns `amount: Number(r.amount)`. A ₹499 plan stored as `"499.00"` →
  `Number("499.00")` → **`499`**.
- Both clients read the same endpoint, `GET /api/v1/payments/subscriptions/plans`
  (`apps/web/src/app/[locale]/(app)/settings/billing/page.tsx:59`;
  `packages/api-client/src/endpoints/payments.ts:101`), which passes `amount`
  through unchanged.
- **Web renders it correctly — no `/100`:**
  `settings/billing/page.tsx:168` `₹{plan.amount.toLocaleString(numberLocale)}`
  and `BillingConfirm.client.tsx:42` `₹{amount.toLocaleString(numberLocale)}` →
  "₹499". This is the correct reference behaviour.
- **Mobile divides by 100:** `apps/mobile/src/app/(app)/billing.tsx:158`
  `{formatINR(plan.amount / 100)}` → `formatINR(4.99)` → **"₹5"**
  (`formatINR` uses `maximumFractionDigits: 0`, so 4.99 rounds to 5).
- **The wrong belief is documented in the client:**
  `packages/api-client/src/endpoints/bookings.ts:9-10` — *"amounts are rupees, not
  paise (the bookings table stores rupees, **unlike subscription plans**)"* — the
  api-client author believed plan amounts are paise. They are not.
- **The mobile test masks the bug** by mocking the wrong unit:
  `apps/mobile/src/features/payments/__tests__/billing.test.tsx:62` —
  `amount: 49900, // paise → ₹499`. With the paise mock, `/100` yields 499 and the
  test is green — over a live 100× defect. The API never sends 49900.

**Why P1.** This is a customer-facing pricing error of exactly 100× on the primary
monetisation screen, it contradicts the web client and the API's own unit, and it
is hidden by a mis-unit'd test — the textbook silent-100× the brief targets. A user
sees Premium at "₹10/yr", subscribes, and Razorpay charges the real amount
(startSubscription uses the plan's Razorpay plan id, not the displayed number), so
the mismatch is also a trust/chargeback risk.

**Fix direction (deferred).** Drop the `/100` at `billing.tsx:158` (the value is
already rupees), and fix the test mock to `amount: 499` so it can never re-mask
this. Correct the api-client doc comment. The mobile `format.ts` header already
states the correct contract ("every amount that reaches mobile is in RUPEES … a
silent 100x error … is the worst class of bug this screen can ship") — this screen
violates its own module's rule.

---

## §2 — Float Contamination

### 2.1 The reassuring part — `Math.round(x*100)` on `decimal(12,2)` is exact

`decimal(12,2)` values carry at most 12 significant digits; IEEE-754 `float64`
represents every such value, and their ×100, exactly. So the standard pattern used
across the payments code — `Math.round(parseFloat(decimalString) * 100)` — is
**exact for every realistic amount** (up to ~₹900 billion). The boundary/float
agent flagged 8 "CRITICAL" + 9 "HIGH" float items; **most are this correct guard,
not defects**, and are reported here as SAFE:

- `lib/money.ts:11-26` `rupeesToPaise`/`paiseToRupees` — the Razorpay-edge
  converter. `Math.round(rupees * 100)` is exact; validates finite/non-negative.
  This is the guard, not a bug.
- `payments/service.ts:96-101` escrow order, `payouts.ts:50-52` fee/net,
  `reconciliation.ts:59,71` compare, `refunds.ts:238` — all `Math.round(...*100)`
  or exact `*0.5`. No precision loss at realistic magnitudes.

### 2.2 — A2-09 · OBS (systemic, P1-worthy) — no type-level paise/rupee distinction

Paise and rupees are **both** `number`/`string`. Nothing at compile time stops a
paise value being used where rupees are expected, or vice-versa. The entire 100×
defence is the naming convention `rupeesToPaise` plus reviewer discipline — which
**already failed once in production** (`lib/money.ts:8`, 2026-05-04) and has now
failed again on mobile (§1.1). This is the single most valuable structural
remediation: a branded `Paise`/`Rupees` type (or a `Money` value object as
ADR-001 seeds for pricing) would make each of these a compile error.

### 2.3 — A2-04 · P2 — Wallet balance is a float read-modify-write with no lock

**Evidence.** `apps/api/src/payments/wallet.ts:58-64` (credit) and `:114-120`
(debit): `const newBalance = parseFloat(wallet.balance) + input.amount;` then
`.set({ balance: String(newBalance), … })`. The denormalised `wallets.balance`
(and `lifetimeIn/Out`) is read, mutated in float, and written back as a string,
inside a `db.transaction` but with **no `SELECT … FOR UPDATE`** on the wallet row.

**Why P2.** Two concerns, both bounded: (1) float accumulation
(`0.1 + 0.2 = 0.30000000000000004`) is absorbed by the column's `scale: 2` rounding
on write, so it does not persist — but the in-memory value pushed to the audit log
and notification payload is the raw float. (2) Concurrent credits can **lost-update**
the denormalised balance (both read the same starting balance; one overwrites the
other). The append-only `wallet_transactions` ledger with `balance_after` snapshots
remains the source of truth and can reconstruct the balance, so blast radius is the
denormalised cache, not the ledger. Fix direction: `FOR UPDATE` on the wallet row
(or an atomic `balance = balance + :amount` SQL update).

### 2.4 — OBS — `advisor.service.ts:126` casts bigint→float

`const suggestedPaise = BigInt(Math.round(Number(rule.base.paise) * clampedMultiplier));`
The `Number(rule.base.paise)` cast defeats the exact reason ADR-001 stored the base
as `bigint` ("amounts beyond `Number.MAX_SAFE_INTEGER`"). For any realistic base it
is exact, and the multiplier is a `doublePrecision` float anyway, so the whole
formula is float-precision by design and the result is a rounded, overridable
*suggestion* — not a stored transaction. OBS only.

---

## §3 — Rounding

**Every money division/percentage checked has a defined rounding rule**, and the
CGST/SGST and dispute splits guarantee their sum by computing one side and taking
the other as the residual. The gaps are **coverage and duplication**, not undefined
rounding.

| Computation | File:line | Rule | `sum` guaranteed? | Test? | Verdict |
|---|---|---|---|---|---|
| GST total + CGST/SGST split | `payments/invoiceService.ts:63-71` | `Math.round(x*rate)/100`; `half = Math.round(tax*50)/100`; `sgst = tax − half` | Yes (residual) | **No** | **P2 — A2-06** |
| GST (PDF re-impl) | `b2b/invoice-pdf.ts:56-59` | same formula, separate code | Yes (residual) | b2b path only | **P2 — A2-06** |
| Dispute SPLIT | `payments/dispute.ts:253-254,393-394` | `Math.round(escrow*ratio)`; customer = residual | Yes (residual) | Yes (`dispute.test.ts`) | SAFE |
| Payout fee / net | `payments/payouts.ts:50-52` | `Math.round(gross*pct*100)/100`; net = residual | net only (via subtraction) | No | OBS |
| Promo % discount | `payments/promo.ts:86-96` | `(amount*pct)/100`, cap, **then** round | — | Yes (cap only) | **P2** |
| Escrow 50% | `payments/service.ts:97` | `Math.round(total*0.5)` → **whole rupees** | — | Yes (`service.test.ts`) | OBS |
| Pricing multiplier | `pricing/advisor.service.ts:126` | `Math.round(Number(basePaise)*mult)` | — | No (no fractional-paise case) | OBS |

### 3.1 — A2-06 · P2 — GST is untested in `invoiceService` and implemented twice

The persisted-invoice GST (`invoiceService.ts:63-71`) has **no dedicated test** —
across `apps/api/src/**/__tests__`, only `b2b/__tests__/b2b.test.ts` and
`vendors/__tests__/approval.service.test.ts` reference `cgst/sgst/igst`. The GST
math itself is correct (round then residual-subtract guarantees
`cgst + sgst == totalTax`), so this is a **coverage gap, not undefined rounding** —
hence P2, downgraded from the rounding agent's "P1: no test". Separately, the same
GST formula is implemented **twice** — `invoiceService.ts` (the row that gets
stored) and `b2b/invoice-pdf.ts:49-74` (the number that gets printed). They agree
today; with no shared helper they can silently drift, so a stored invoice and its
PDF could show different tax. Fix direction: extract one GST helper, cover it with a
rounding-focused test (odd rupee amounts, intra- vs inter-state).

### 3.2 — P2 — Promo caps before rounding

`promo.ts:86-96` computes the PERCENT discount unrounded, applies the `maxDiscount`
cap to the **unrounded** value, then rounds. The final discount can differ by a
paisa from "cap, then round" — bounded and defined, but an inconsistent order worth
pinning with a test.

---

## §4 — Display & PDF

### 4.0 On-screen display — verified clean (with one exception in §1.1)

Four money-formatter families exist, in **two unit conventions**:

| Util | Input unit | Locale / glyph | Notes |
|---|---|---|---|
| `apps/api/src/lib/currency.ts` `formatMoney`/`formatMoneyAscii` | **paise** (bigint/str) | en-IN; ₹ or "Rs." | model impl, ~40 tests, lossless BigInt |
| `apps/web/src/lib/currency.ts` `formatWireMoney` | **paise** (wire str) | en-IN | for the paise wire shape |
| `apps/web/src/lib/format.ts` `formatINR` | **rupees** (float) | en-IN; ₹ | legacy decimal columns |
| `apps/mobile/src/lib/format.ts` `formatINR` | **rupees** (float) | en-IN; ₹ | mirrors web `format.ts` |

Display call-sites that handle **paise** values correctly divide by 100 before
rendering — `PricingBreakdown.client.tsx:9-14` (custom `inr()`),
`LendingClient.client.tsx:16-18`, `BudgetLendingCard.client.tsx:18-20` — so no
on-screen paise→rupee 100× exists **except** the mobile billing screen (§1.1, where
a rupee value is wrongly divided by 100).

### 4.1 — A2-02 · P1 (CONFIRMED) — ₹ glyph is a black box on the customer TAX INVOICE

**What.** The booking tax-invoice PDF renders every amount with the U+20B9 rupee
glyph into a default-Helvetica PDFKit document. Helvetica's WinAnsi encoding has no
₹ glyph, so it renders as a **black box / blank** on the customer's invoice.

**Evidence.**
- `apps/api/src/bookings/invoice.ts:19-21` —
  `function formatInr(amount) { return '₹' + amount.toLocaleString('en-IN', …); }`
- The document registers **no font** — it uses PDFKit's default Helvetica
  (`invoice.ts:36,42,49,…` `.font('Helvetica')` / `'Helvetica-Bold'`).
- `formatInr` is called for every money value: line items `:153`, subtotal `:173`,
  amount paid `:179`, balance due `:194`.
- **Live-wired**, not dead code: `apps/api/src/bookings/router.ts:318`
  `await generateInvoice({…})` on the booking-invoice download endpoint.
- **The PDF-safe tool exists, is tested, and is bypassed here.**
  `apps/api/src/lib/currency.ts` `formatMoneyAscii` emits "Rs." and is covered by a
  non-ASCII-byte assertion (`__tests__/currencyDisambiguation.test.ts:50-57`,
  `:46` asserts `formatMoneyAscii(…, 'INR') === 'Rs.…'`). The **other three** PDF
  generators all render safely:
  - `b2b/invoice-pdf.ts` → `formatRupees()` → "Rs." (`lib/pdf/format.ts:11-17`).
  - `documents/contract-pdf.ts:92` → `line.replace(/₹/g, 'Rs.')` (defensive).
  - `reports/report-pdf.ts` → `formatRupees()` → "Rs.".
  Only `bookings/invoice.ts` uses the raw glyph. (`weddings/invite-pdf.ts` renders
  no currency.)

**Why P1.** Every booking invoice a customer downloads shows black boxes where the
amounts should be — on the one document most likely to be forwarded, printed, or
filed for GST. It is triggerable with no code change on our side and contradicts the
repo's own established "Rs." convention.

**Proof to run once a fix pass can render one (documented, not runnable in a
read-only pass):**
```
pdftotext -layout invoice.pdf - | grep -n "■"
```
A hit on the *current* code confirms the black box; zero hits after routing through
`formatMoneyAscii` confirms the fix. (A PDF cannot be generated in this read-only
pass; the static evidence — a raw U+20B9 fed to Helvetica — already proves the
defect.)

**Fix direction (deferred).** Render amounts through `formatMoneyAscii` / a "Rs."
formatter (as the sibling generators do). Note the invoice also passes rupee
`totalAmount`/`escrowAmount` values (`router.ts:324-325`) — unit-consistent; only
the glyph is the P1.

### 4.2 — A2-07 · P2 — PDF `formatRupees` has no lakh/crore grouping

`apps/api/src/lib/pdf/format.ts:15-17` — `formatRupees(amount)` returns
`` `Rs. ${amount.toFixed(2)}` `` — **no thousands/lakh grouping** (`Rs. 1234567.89`,
not `Rs. 12,34,567.89`). Used by the B2B GST invoice and the analytics report PDFs.
"Rs." is safe (§4.1), but grouping is missing on customer/vendor-facing money, and
the amount is held as a JS `number` (float) throughout the B2B invoice path
(`b2b/invoice-pdf.ts` `unitPrice: number`, `subtotal += …`). Fix direction: format
with `Intl.NumberFormat('en-IN', { style:'decimal', minimumFractionDigits:2 })`
prefixed with "Rs. ".

### 4.3 — A2-08 · P2 — Web currency util diverges from the API for the `$` family

`apps/web/src/lib/currency.ts:41-43` maps `CAD:'en-CA', AUD:'en-AU', SGD:'en-SG'`,
whereas `apps/api/src/lib/currency.ts:45-47` deliberately maps them to `en-US` so
the four dollar currencies render as distinguishable `CA$ / A$ / SGD` (asserted by
`currencyDisambiguation.test.ts:20-32`). The web file's header claims it "mirrors
the API" but does not, so NRI multi-currency lists render an ambiguous bare `$`.
Its ASCII branch (`:174-178`) also does a blind `.replace('$','US$')` that would
mislabel CAD as US$ — the exact mistake the API's disambiguation test exists to
prevent. Web-only, NRI surface → P2.

### 4.4 — A2-10 · OBS — The shared paise formatters are dead code

`formatMoneyAscii` (`apps/api/src/lib/currency.ts:265`) and `formatWireMoney`/
`formatWireMoneyAscii` (`apps/web/src/lib/currency.ts`) are **not called from any
production path** — components re-implement `÷100 + en-IN` locally (`PricingBreakdown`,
`LendingClient`, `BudgetLendingCard`, and the mis-unit'd `billing.tsx:158`). A
well-tested, correct utility sits unused while its logic is scattered across
one-off helpers — and that scatter is exactly where the §1.1 mobile 100× crept in.
Consolidating on the shared formatter (and the §4.1 PDF path onto `formatMoneyAscii`)
removes the duplication that breeds these unit bugs.

---

## §5 — Idempotency

### 5.0 What is safe (verified)

| Operation | Mechanism | Verdict |
|---|---|---|
| Razorpay webhook delivery | `webhook_events` unique `(provider, event_id)` + pre-check **before** side-effects (`webhook.ts`), returns 202 on replay | **SAFE** |
| Dispute resolution | `dispute_resolutions` unique `(booking_id, resolution_id)` + `onConflictDoNothing` + re-fetch of the stored outcome (`dispute.ts:249-290`) | **SAFE** |
| Escrow release | CAS `HELD → RELEASE_PENDING` in one conditional UPDATE (`escrowReleaseJob.ts`) — a retry sees a non-`HELD` status and skips the transfer | **SAFE** |
| Refund / payout start | conditional UPDATE to `PROCESSING` `.returning()`; throws `CONCURRENT_UPDATE` if it loses the CAS (`refunds.ts:210-215`, `payouts.ts:86-99`) | **SAFE against concurrent double-start** |

### 5.1 — A2-03 · P1 — Razorpay retries are not idempotent, despite the docstring

**What.** `lib/razorpay.ts:2` advertises *"real SDK with idempotent retries"*, but
the retries carry **no idempotency key**, so a money-out call whose response is lost
is re-sent and **executes twice**.

**Evidence.**
- `apps/api/src/lib/razorpay.ts:52-65` `withRetry` retries up to 3× on
  `status >= 500`, `429`, **or `status === 0`** (a lost/timed-out response) with
  exponential backoff.
- The money-out calls pass no idempotency key to Razorpay:
  - `createRefund` (`:174-192`) → `sdk.payments.refund(paymentId, { amount, speed,
    notes })` — Razorpay permits multiple partial refunds on one payment, so a
    retried refund creates a **second** refund.
  - `transferToVendor` (`:196-213`) → `sdk.transfers.create({ account, amount, … })`
    — a retried transfer **double-pays** the vendor.
  - `createOrder` (`:115-136`) — `receipt` is passed but not a unique-enforced
    idempotency key.
- Razorpay supports `X-Razorpay-Idempotency-Key`; none is set anywhere.

**Why P1.** The CAS state guards (§5.0) prevent *concurrent* double-starts, but they
do **not** cover the lost-response case: `withRetry` re-invokes the *same* call
inside one logical operation before any status is written, and on a
timeout-then-success at Razorpay the customer/vendor is refunded/paid twice while
our row still reads a single refund/payout. The file's own header claims this is
already handled; it is not. Fix direction: pass a deterministic
`X-Razorpay-Idempotency-Key` (e.g. the refund/payout row UUID) so Razorpay dedupes
the retry, and reconcile against `reconciliation_discrepancies`.

### 5.2 — A2-05 · P2 — Wallet topup: dedup TOCTOU + whole-rupee credit

**Evidence.**
- `apps/api/src/payments/wallet.ts:208-214` `creditWalletForTopup` dedups on
  `metadata->>'razorpayPaymentId'` with a `SELECT … LIMIT 1` **outside** the
  `creditWallet` transaction, and there is **no unique index** backing that key.
  Two distinct webhook events for the same payment, racing, can both pass the check
  and double-credit. Mitigated (not eliminated) by the upstream `webhook_events`
  unique guard, which short-circuits an identical event replay before this runs.
- `apps/api/src/payments/webhook.ts:146` —
  `creditWalletForTopup(userId, Math.round(amount / 100), entity.id)`. `amount` is
  paise; `Math.round(paise/100)` credits **whole rupees**, so a non-round topup
  (e.g. 10050 paise = ₹100.50) mis-credits by up to ₹0.49, even though the wallet
  column is `decimal(12,2)` and could hold the exact value.

**Why P2.** Bounded blast radius (topups only; the primary webhook dedup covers the
common replay; the rounding error is ≤ ₹0.49). Fix direction: add a unique index on
the topup dedup key and move the check inside the credit transaction; pass
`amount / 100` (exact) rather than `Math.round(amount / 100)`.

---

## Baseline note

This is a read-only reporting pass. It changes no source, generates no migration,
runs no test, and does **not** move the frozen regression baseline
(API 1388 · ai-service 452 · web 24 · mobile 208 · Playwright 7 specs / 23 cases).
All findings are static/structural; the two `.test` files cited (§1.1 mobile
billing mock, §3.1 GST coverage) are cited for what they assert (or fail to
assert), not executed.

## Cross-reference to fix work (deferred — do not action in an audit pass)

| ID | Sev | Finding | First place to look | Pattern to copy |
|---|---|---|---|---|
| A2-01 | **P1** | Mobile plan price ÷100 (100× low) | `apps/mobile/src/app/(app)/billing.tsx:158` | web `settings/billing/page.tsx:168` (no `/100`) |
| A2-02 | **P1** | ₹ glyph black box on tax invoice | `apps/api/src/bookings/invoice.ts:19-21` | `b2b/invoice-pdf.ts` + `formatMoneyAscii` |
| A2-03 | **P1** | Non-idempotent Razorpay retries | `apps/api/src/lib/razorpay.ts:52,115,174,196` | `X-Razorpay-Idempotency-Key` = row UUID |
| A2-04 | P2 | Wallet float RMW, no row lock | `apps/api/src/payments/wallet.ts:58-64,114-120` | `FOR UPDATE` / atomic `balance = balance + :amt` |
| A2-05 | P2 | Topup TOCTOU + whole-rupee credit | `wallet.ts:208-214`; `webhook.ts:146` | unique index + in-txn check; `amount/100` |
| A2-06 | P2 | GST untested + duplicated impl | `payments/invoiceService.ts:63-71`; `b2b/invoice-pdf.ts:56-59` | one shared GST helper + rounding test |
| A2-07 | P2 | PDF `formatRupees` no grouping | `apps/api/src/lib/pdf/format.ts:15-17` | `Intl.NumberFormat('en-IN', decimal)` |
| A2-08 | P2 | Web `$`-family locale divergence | `apps/web/src/lib/currency.ts:41-43,174-178` | mirror API `currency.ts:45-47` |
| A2-09 | OBS | No paise/rupee type distinction | `apps/api/src/lib/money.ts` | branded `Paise`/`Rupees` type |
| A2-10 | OBS | Shared paise formatters unused | `lib/currency.ts` (api + web) | consolidate call-sites onto them |
