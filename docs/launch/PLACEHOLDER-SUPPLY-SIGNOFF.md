# Placeholder supply — client sign-off request

> **Status:** awaiting written response from Colonel Deepak
> **Raised:** 2026-07-19 · **Owner:** Ashwin
> **Blocks:** opening the platform to real users

---

## Why this document exists

Preview (fictional) inventory is live in production and renders alongside real
inventory. That was a deliberate product decision so the platform would not look
empty at launch. It has never been confirmed in writing by the client, and it is
the one decision on the platform that a real user could reasonably feel misled
by. It needs an explicit yes or no, on the record, before launch.

## What is actually live

Seeded to production 2026-07-19. Every row carries `is_placeholder = true`.

| | Count |
|---|---|
| Premium wedding packages | 24 |
| Venue vendors | 12 |
| Destination cities (status `PLANNED`) | 8 |
| Post-marriage categories | 8 |
| Service partners | 16 |
| Post-marriage services | 28 |

None of these are signed partners. Venues, pricing and descriptions are
illustrative.

## What protects users today — verified, not assumed

- **No payment is possible against a package.** `premiumPackages` / `packageId`
  appear in only three files, all inside `apps/api/src/packages/` — nothing in
  bookings or payments references packages at all. There is no money path for
  any package, placeholder or real. The only user action is an enquiry, which
  lands in the admin queue.
- **`assertBookable()` refuses placeholder rows** with `PLACEHOLDER_SUPPLY`
  (`apps/api/src/packages/service.ts`), enforced in the service layer so a
  direct API call is refused too, and covered by
  `apps/api/src/packages/__tests__/placeholder-guard.test.ts`. This is
  belt-and-braces for a payment flow not yet built.
- **No enquiry can reach a fictional venue.** All 12 seeded venue accounts use
  `@seed.invalid` (RFC 2606, permanently unregisterable). Verified in prod:
  0 addresses outside that domain.
- **No seeded account can be signed into.** Verified in prod: 12 seeded venue
  users, **0 credential rows, 0 sessions**.
- **Promotion to a real partner is one update:** `SET is_placeholder = false`.

## What is NOT protected

A visitor browsing the site will believe these venues are available, and the
venue rows carry a `verified` badge. If a journalist, competitor or customer
asks whether the listed venues are real partners, the honest answer is no.

This may carry consumer-protection exposure in India. It should go to the
client's lawyer alongside the T&C and Privacy review already in progress
(ACTION-TRACKER Table 2) — that adds no lead time, and it is not a call
engineering is qualified to make.

## The decision requested

1. **Accept** — launch with preview inventory, publicly framed as such.
2. **Delay** — hold these sections until real partners are signed (~3 months).
   The rest of the platform launches regardless.

## Mitigation shipped ahead of the answer

Assuming option 1, the labelling that makes it defensible is already built:
a "Preview listing" badge on package and service cards, and an inline notice on
both detail pages, in English and Hindi. Placeholder rows are **not** hidden,
filtered or re-ranked, and enquiries stay fully open.

This deliberately reverses the original spec for `isPlaceholder`, which said the
flag must never alter rendering. See the rationale on the field itself in
`packages/types/src/supply.ts`. If the client chooses option 2, or wants the
labelling removed, that is a written decision — not a silent revert.

## Known gap

The 12 seeded venue **vendors** appear in vendor listings with no labelling and
a `verified` badge. `VendorProfile` has no `isPlaceholder` field, so the flag
does not survive to the vendor API or the vendor UI. Closing this needs a change
across api → types → web. **This is the most exposed remaining surface** and
should be closed before real users arrive under option 1.
