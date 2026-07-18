# Phase 6 — Financial Services Reference: 2026 Regulatory + Vendor Addendum

> **Internal planning doc. Patches, does not replace,
> `PHASE-6-FINANCIAL-SERVICES-REFERENCE.md`.** Re-verified July 2026. The base
> doc cited the **RBI Digital Lending Guidelines, 2022** — those have been
> **repealed and replaced**. This addendum records the current framework and the
> verified state of the four aggregators, plus the concrete effect on the
> Tier-3 placement shells (Units 6.2 / 6.3). Nothing here is legal advice —
> confirm with a compliance advisor before any go-live.

---

## 1. Headline correction: the lending framework changed

The 2022 Guidelines the base doc references are **repealed**. The governing law
is now the **RBI (Digital Lending) Directions, 2025**, notified **8 May 2025**.
It consolidates the earlier guidelines/FAQs and the separate Default Loss
Guarantee (DLG) circular into one instrument, with two phased-in additions:

- **Para 17 — DLA reporting** to RBI's CIMS portal: effective **15 June 2025**.
- **Para 6 — multi-lender (RE ↔ LSP) arrangements**: effective **1 November 2025**.

RBI also operationalized a **public "Digital Lending Apps (DLAs)" directory** on
its website from **1 July 2025**, so borrowers can verify a DLA's claimed link to
a regulated entity.

The core legal reality in the base doc still holds: **Smart Shaadi cannot lend
directly.** It can only act as an **LSP (Loan Service Provider)** surfacing offers
from an RBI-registered NBFC/bank; the regulated entity (RE) holds the risk and
the capital, and Smart Shaadi earns a **referral commission** — never interest.

### What's new/sharper under the 2025 Directions (and why it touches our *product*, not just paperwork)

- **Neutral multi-lender display.** If more than one lender's offer is shown, the
  interface must present all matching offers objectively, disclose the RE names
  behind each (including naming lenders that did *not* match), show amount, tenor,
  APR, monthly obligation and penal charges, link each RE's **Key Fact Statement
  (KFS)**, and use **no dark patterns / deceptive UI** to steer to one lender.
  Ranking is allowed only on a pre-disclosed, consistent metric.
- **Fund flow is fixed.** Disbursal goes **straight to the borrower's account**;
  repayments go **straight to the RE's account**. **No pass-through / pool
  account** at Smart Shaadi. LSP fees are **paid by the RE, never collected from
  the borrower**.
- **KFS before agreement**, and digitally-signed loan docs auto-sent to the
  borrower's verified email/SMS on execution.
- **Data rules (DPDP Act 2023-aligned).** Purpose-specific, consent-based,
  minimal collection; **no access to phone contacts/call logs** (one-time KYC
  aside); all borrower data **stored in India** (if processed abroad, deleted and
  restored to India within 24h).
- **Cooling-off** minimum reduced to **1 day** (board-set), penalty-free exit
  (one-time processing fee may be retained if disclosed in KFS).
- **DLA reporting + CCO certification.** Every DLA the RE deploys/joins (including
  the LSP's) must be reported on CIMS; the RE's Chief Compliance Officer certifies
  accuracy. As an LSP, Smart Shaadi's app becomes part of the RE's reportable DLA
  list — a due-diligence touchpoint in any agreement.
- **DLG cap** stays at **5%** of the disbursed portfolio (relevant only if a DLG
  arrangement is ever contemplated — likely not for a pure referral LSP).

**Net effect on our build:** the mocked lending **placement + consent screens
(Unit 6.2)** should already bake in: LSP-not-lender labelling, KFS link slot,
neutral multi-offer layout, no pre-ticked consent, no steering UI, and a data
model that assumes borrower-direct disbursal / RE-direct repayment (no money
through us). Building the mock to these rules now means the live swap later is a
credential change, not a redesign.

---

## 2. Verified vendor state (July 2026)

All four aggregators from the base doc are still operating. Key deltas:

### Lending

- **FinBox** (Moshpit Technologies Pvt. Ltd., Bengaluru) — still positions as the
  API-first "operating system for digital lending": modular embedded-finance /
  partnership-lending stack, pre-integrated lender network, one integration →
  multiple lenders, AI decisioning (Sentinel), alternate-data underwriting, AA
  support. Still the more **turnkey "embedded lending with a lender network
  attached"** option. (The "launch in ~3 days" line remains marketing — real
  integration + compliance is longer.)
- **Setu — now "Setu by Pine Labs"** (acquisition confirmed; Pine Labs listed
  Nov 2025). Lending APIs, Account Aggregator, BBPS (EMI collection), eSign/
  e-NACH, KYC. Still the more **modular infra** option — cleaner rails, you
  assemble more, and may still need the NBFC relationship separately. More
  balance-sheet stability now as part of a listed parent.

**Practical read (unchanged):** for a *first* referral loan, FinBox is the faster
path to a working product; Setu is worth it if the AA/BBPS rails are independently
useful.

### Insurance

- **Zopper** (Solvy Tech Solutions, Noida) — still one of India's most
  established B2B embedded-insurance infrastructure players (14+ yrs), IRDAI-
  compliant, modular sachet SKUs (device/warranty, health, life, motor, travel),
  handles issuance/servicing/claims/compliance/payouts. Raised **$25M (2025)**;
  IPO signalled in a 3–5 yr horizon. Best **enterprise-proven rails + broad SKU
  catalogue**.
- **Turtlemint / Turtlefin** — operates as an **IRDAI-licensed insurance broker**
  (multi-insurer, fiduciary to the policyholder), 40+ insurers, ~3 lakh advisors;
  offers both API-embed and white-label paths; expanding into SE/West Asia. Best
  if you want a **white-label quick-launch** or the **advisor-assisted** model
  (useful if wedding cover needs human explanation). Note: it's a **broker**, a
  distinct intermediary category from the "corporate agent / web aggregator"
  framing in the base doc — brokers place across many insurers rather than tie to
  a few.

**Insurance nuance (unchanged and important):** wedding/event insurance is a
**real but niche** product, NOT a standard embedded SKU. Lead with a standard SKU
(health/life/travel) that ships fast; arrange wedding-event cover as a second
step. Flag this to Colonel as a product decision.

*Also on the radar if terms don't fit: Riskcovry (insurance-in-a-box), SecureNow
(SME/commercial risk), Toffee (micro/sachet), PolicyBazaar (listed). Re-verify
before any commitment.*

---

## 3. Unchanged bottom line

Phase 6 financial services remain **"a small amount of our code, gated on a
business relationship we don't control."** The long pole is partner agreement +
compliance sign-off + aggregator due-diligence (weeks–months, external), plus
Colonel's commercial decision on *which* partner and *what* terms. Do **not**
promise it in a one-month, code-only window. Build the flagged, mocked placement
shells (Units 6.2 / 6.3) now — to the 2025/IRDAI rules above — so the live swap
is credentials-only.

---

*Sources (re-verify before any commitment): RBI (Digital Lending) Directions,
2025 (notified 8 May 2025; DLA-reporting from 15 Jun 2025; multi-lender rules
from 1 Nov 2025; RBI DLA directory live 1 Jul 2025); vendor sites finbox.in,
pinelabs.com/Setu, zopper.com, turtlemint/turtlefin; 2026 industry roundups.
Figures directional. Not legal advice.*
