# PASS 4 — Client-Facing + Compliance

> **Scope:** client-facing surfaces + regulatory/compliance posture. **READ-ONLY audit — nothing fixed.**
> **Method:** static analysis of the repo (grep + file reads + read-only `git`). Prod/runtime state is flagged as "operator-verify" where it cannot be confirmed from code.
> **Auditor:** Claude Code · **Lead Developer:** Ashwin Hingve · **Date:** 2026-07-26
> **Companion docs:** `PASS-0-INVENTORY.md`, `PASS-1-FINDINGS.md`, `docs/launch/LAUNCH-CHECKLIST.md`, `docs/phase-5-8/PHASE-6-FINANCIAL-SERVICES-REFERENCE-ADDENDUM-2026.md`.

## Verdict

The **code** is in good compliance shape; the **platform** is correctly gated 🔴 NO-GO on external
registrations (per `LAUNCH-CHECKLIST.md`). This pass found **one new code-fixable P0** (a client-facing
branding leak on the booking invoice) plus several P1/P2 items and operator-verification gaps. Two whole
areas are clean passes (i18n parity, SEO).

| # | Sev | Area | Finding | Fix owner |
|---|-----|------|---------|-----------|
| 1 | **P0** | Branding | Booking-invoice PDF header/footer say **"VivahOS"**; support contact `support@vivah.os` (non-existent domain) | Lead Developer (code) |
| 2 | **P1** | Legal | Legal pages are self-declared **unreviewed drafts**; **Grievance Officer name is a placeholder**; **Refund/Cookie footer links disabled** | Colonel/lawyer (A3) + code |
| 3 | **P1** | Launch | **44 seeded QA accounts** (incl. 2 ADMIN + 2 SUPPORT) have **no prod guard**; loginable via mock OTP | Lead Developer + operator |
| 4 | **P1** | Mock honesty | Mocked **payments/OTP** carry no per-surface "test mode" label; demo pill is gated on a *different* flag | Lead Developer + ops |
| 5 | P1/P2 | Launch | `NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'` fallback in ~45 web files + middleware, no build guard | ops (verify env) |
| 6 | P2 | Branding | `ai-service` OpenAPI title **"VivahOS AI Service"**; Vercel alias `vivah-web.vercel.app` | Lead Developer |
| 7 | P2 | Regulatory | Insurance shell shows a **"Recommended" badge** (mild non-neutral display) | Lead Developer (pre go-live) |
| 8 | P2 | Launch | `MIGRATIONS-PENDING.md` stale — documents ≤0029; **0030–0039 undocumented**; two stale "PENDING" headers | Lead Developer + operator |
| 9 | P2 | Launch | Media **DNS cutover mismatch**: API prod `R2_PUBLIC_URL` still raw bucket, mobile expects `media.smartshaadi.co.in` | ops |
| 10 | P2 | Mock honesty | 80 fictional **placeholder venues** shown to public with no "preview" label (booking blocked) | Colonel + Lead Developer |
| ✓ | PASS | i18n | en/hi **perfect parity** — 3501/3501 keys, 0 missing | — |
| ✓ | PASS | SEO | No global noindex; per-page noindex + robots + sitemap correct | — |
| ✓ | PASS | Regulatory | **Lending** shell matches RBI (Digital Lending) Directions 2025 checklist | — |
| ✓ | PASS | GDPR/DPDP | Data **export + delete + consent ledger** all implemented | — |

---

## 1. Branding — "vivahOS"/"vivah" leakage

The public product is **Smart Shaadi**; **"VivahOS"** is the internal codename and must never
be client-visible. Note: **"vivah" (विवाह) is the Hindi common noun for *marriage***, so its
appearance in SEO keywords and ceremony/service names is legitimate domain vocabulary — **not** a
codename leak. Only the capitalised codename **"VivahOS"** / `vivah.os` / `vivah-web` are true leaks.

### P0 — Client-facing: booking-invoice PDF is branded "VivahOS"
`apps/api/src/bookings/invoice.ts` (the consumer booking invoice, streamed to paying customers via
`apps/api/src/bookings/router.ts:318`):
- **L37** — `.text('VivahOS', 50, 50)` — 28pt burgundy **brand header** on every invoice.
- **L207** — `.text('Powered by VivahOS — Smart Shaadi', ...)` — footer.
- **L208** — `'For disputes contact support@vivah.os | This is a computer-generated invoice.'` — the
  **dispute contact is a non-existent domain** (`vivah.os` is not a valid TLD). A tax invoice with a
  dead disputes address is both a branding leak **and** a customer-service defect.
- **L9** — comment `// VivahOS brand colours` (internal, not rendered).

> **This P0 was not caught by prior audits** (`PHASE-1-4-AUDIT.md` reports "0 code-fixable P1 open").
> **Clean by contrast:** the **B2B** invoice `apps/api/src/b2b/invoice-pdf.ts` correctly uses
> "Smart Shaadi brand colours" and a generic "INVOICE" header — no codename. Only the consumer
> invoice leaks.

### P1 — SMS sender ID is the codename ("VIVAH") — client-visible when MSG91 goes live
`apps/api/.env:17` and root `.env:40` set **`MSG91_SENDER_ID=VIVAH`**. When MSG91 is live (currently
mocked), every OTP / transactional SMS shows sender header **"VIVAH"** — a client-visible codename leak on
the platform's most-used message. It is **not** pinned in the committed `.env.example` / `.env.production`
templates (so it's a dev-env value), but the DLT-registered sender ID provisioned for prod (blocker A2)
**must be a Smart Shaadi brand token**, not "VIVAH". **Operator-verify** the Railway `MSG91_SENDER_ID` at
launch and add the intended value to `.env.example` so it isn't defaulted to the codename.

### P2 — Developer-facing codename leaks
- `apps/ai-service/src/main.py:82` — `title="VivahOS AI Service"` → surfaces in the FastAPI
  OpenAPI/`/docs` title if that endpoint is reachable.
- `apps/api/src/lib/cors.ts:6-26` — Vercel project alias `vivah-web.vercel.app` (CORS allowlist +
  comments). If the site is ever reached via that alias instead of `smartshaadi.co.in`, "vivah" shows
  in the address bar. Rename the Vercel project or ensure canonical-host redirects.

### Client-visible but benign (the Hindi word "vivah" = marriage) — confirm acceptable
- `apps/web/src/app/[locale]/(marketing)/layout.tsx:13` — SEO keywords `'shaadi, vivah, arranged marriage, …'`.
- `packages/db/seed/data/demo-traffic-india.json` — service names "Complete Vivah Sanskar" (the Hindu
  marriage ceremony), and `packages/db/seed/calendar-data.ts` "Vivah Muhurat".
- **Assessment:** legitimate matrimony vocabulary, not the codename. Left as-is unless the client wants
  strictly-English keyword copy.

### Internal-only (not client-visible) — no action
`apps/api/src/vitest.setup.ts` (`vivah_test` DB name), `apps/api/src/weddings/website.service.ts:35`
(`vivah-site:` hash salt), plus `.venv`/`.turbo`/`.data` build artifacts.

### Ashwin's title — PASS
No client-facing document titles Ashwin "Founder". All docs use "developer" / "Ashwin Hingve
(developer)" (e.g. `docs/RUNBOOK.md:4`, `docs/PROVIDER-ACTIVATION/README.md:5`). The one `"Founder"`
string is `apps/web/src/app/[locale]/ui-preview/UiPreview.client.tsx:186` — the profession on a **generic
demo ProfileCard ("Broken Photo")** inside a **noindexed** internal component gallery, unrelated to
Ashwin. This report titles him **Lead Developer** as instructed.

---

## 2. Mock-vs-Live Honesty

### Lending / Insurance placement shells — PASS (labelled not-live)
Both `services/lending/*` and `services/insurance/*` render a **not-live banner** when preview:
`isPreview = mock || !LENDING_LIVE` (`lending/page.tsx:46`), banner in `LendingClient.client.tsx:47-52`
and `InsuranceClient.client.tsx:51-56`. Copy (`servicesLending.previewBanner`): *"Not live yet —
preview… No application is submitted and no data leaves Smart Shaadi."* Fully translated to Hindi. No
mocked offer is presented as a real financial product. (Regulatory copy assessed in §3.)

### P1 — Payments (Razorpay) + OTP (MSG91) mocks: labelling can desync from mock state
The only in-app mock indicator is `components/shared/DemoPill.tsx`, gated on **`NEXT_PUBLIC_DEMO_MODE ===
'true'`** (`:21`) — a **different flag** from `USE_MOCK_SERVICES`, which is what actually mocks
Razorpay/MSG91. So the checkout and OTP screens have **no per-surface "test mode" label**; if a build
runs with `USE_MOCK_SERVICES=true` but `NEXT_PUBLIC_DEMO_MODE` unset, a **mocked payment can look real**.
- **Mitigated at launch:** per `LAUNCH-CHECKLIST.md` the master flip sets `USE_MOCK_SERVICES=false` and
  **removes `MOCK_OTP_VALUE`** — so at true go-live nothing is mocked.
- **Action:** ensure real users never transact while `USE_MOCK_SERVICES=true`; ideally drive DemoPill (or
  a checkout "test mode" ribbon) off the real mock flag so the two cannot desync.

### P2 — Placeholder supply shown without a "preview" label
`LAUNCH-CHECKLIST.md` B7: **80 fictional supply rows** (24 packages / 28 post-marriage services / 16
partners / 12 vendors) are shown to the public. `is_placeholder` is **internal-only** (never labels the
row in the UI); the honesty control is that `assertBookable` (`apps/api/src/packages/service.ts`) blocks
booking/payment with `PLACEHOLDER_SUPPLY` and routes enquiries to admin. The public sees plausible
venues with no "not a real partner yet" badge. **Consciously accepted 2026-07-19** ("ship as-is, guard
ON"). No transaction can complete, so this is a documented product decision, not a P0 — surfaced here for
visibility.

### KYC intentionally mocked (Section C) — minor
`KYC_LIVE` stays unset at launch (DigiLocker pending), so KYC is stubbed → `MANUAL_REVIEW`. Ensure the
"verified" UI does not imply real Aadhaar/DigiLocker government verification while mocked.

---

## 3. Regulatory Copy (lending / insurance)

Governing law per the repo's own **`PHASE-6-FINANCIAL-SERVICES-REFERENCE-ADDENDUM-2026.md`**: the 2022
guidelines are **repealed**; the **RBI (Digital Lending) Directions, 2025** (notified 8 May 2025) apply.
Smart Shaadi can only act as an **LSP**, never lend directly.

### Lending shell — PASS (matches the 2025 checklist item-for-item)
Verified in `LendingClient.client.tsx` + `lending/actions.ts` + i18n `servicesLending.*`:
- **LSP-not-lender labelling** — *"Smart Shaadi is a Loan Service Provider (LSP), not the lender."* ✓
- **KFS link slot** — per-offer `href={o.kfsUrl}` "View Key Fact Statement (KFS)" (`:112-119`). ✓
- **Neutral multi-offer display** — radio list, code comment *"no steering, no highlighted 'best'"*; no
  ranking badge. ✓
- **No pre-ticked consent** — `useState(false) // never pre-ticked` (`:27`); `actions.ts:12-16` comment:
  *"the API rejects any other value (RBI Digital Lending Directions 2025 — no pre-ticked consent)."* ✓
- **No funds through Smart Shaadi** — *"Funds are disbursed directly to your bank account… Smart Shaadi
  never handles your money"*; consent discloses the **referral fee**. ✓

### Insurance shell — mostly PASS, one P2
Referrer disclosure is correct (*"Smart Shaadi is not the insurer and earns a referral fee, never your
premium"*), insurer grievance link present. **P2:** `InsuranceClient.client.tsx:105-109` renders a
**"Recommended" badge** on `q.lead`, and `disclosure.detail` says *"We lead with standard health cover"* —
a mild **non-neutral display** signal. Under IRDAI (broker/aggregator) neutrality expectations, any
ranking/recommendation needs a pre-disclosed, objective basis. Low urgency (surface is preview/not-live)
but must be resolved before insurance goes live.

> Both shells are preview-gated and the addendum itself states go-live is "gated on a business
> relationship we don't control" and "confirm with a compliance advisor before any go-live."

---

## 4. Legal Pages

All four exist under `apps/web/src/app/[locale]/(legal)/{privacy,terms,refund-policy,cookie-policy}` and
have **substantive content** (12 / 13 / 7 / 5 sections; DPDP-aware; **not lorem**). Reachability is
**split**: Privacy (`Footer.tsx:54`) and Terms (`:55`) are footer-linked, but **Refund Policy (`:56`) and
Cookie Policy (`:57`) have their footer links disabled** (`href:'#', disabled:true`, rendered
`aria-disabled`) — see the P1 below.

### P1 — They are self-declared UNREVIEWED DRAFTS (launch blocker)
Every page shows a visible disclaimer:
- Privacy & Terms: **"Starter template — not legal advice."** … *"must be reviewed and finalised by
  qualified legal counsel (and translated for Hindi readers) before public launch."*
- Refund & Cookie: **"Draft — pending legal review."**

This matches `LAUNCH-CHECKLIST.md` **A3 (legal review) = 🔴 OPEN**. Launch blocker; owner is the
client/lawyer.

### P1 — Grievance Officer name is a placeholder (DPDP gap)
Privacy §6 "Grievance redressal": **"Grievance Officer: (name to be inserted before launch). Email:
grievance@smartshaadi.co.in."** DPDP Act 2023 requires a **named** grievance officer. Email exists; name
is TBD. Also Terms §11 leaves court jurisdiction *"to be specified before launch."* Third-party
processors are disclosed (Razorpay, MSG91, DigiLocker — Privacy §7).

### P1 — Refund & Cookie policy footer links are disabled (reachability gap)
`components/marketing/Footer.tsx` links Privacy (`:54`) and Terms (`:55`), but **Refund Policy (`:56`) and
Cookie Policy (`:57`) are `{ href: '#', disabled: true }`** — rendered `aria-disabled` (`:73-76`), so they
are **not reachable from the footer** even though both pages exist with real content. A refund/cancellation
policy that users cannot reach is a consumer-law + payment-partner (Razorpay) issue. **Operator-verify**
these are reachable via another entry point (settings/billing/checkout) or enable the footer links before
launch.

---

## 5. GDPR / DPDP Data Rights — PASS

- **Data export (Article 15)** — `apps/api/src/routes/gdpr.ts`: `POST /export/request` enqueues a Bull
  job (`jobs/dataExportJob.ts` → `services/dataExportService.ts`), status polling, and
  `GET /export/:id/download` returns a **presigned R2 URL** with expiry; **rate-limited 1/day**;
  **owner-checked** (403 on mismatch). UI: `settings/data-export/page.tsx` (in nav). ✓
- **Account deletion / erasure** — `settings/security/SecurityDashboard.client.tsx:536` →
  `POST /api/v1/me/account/delete` with a "type *delete my account*" confirm. Backend
  `apps/api/src/auth/securityRouter.ts:210` sets `deletionRequestedAt` + `status:'SUSPENDED'`, revokes
  sessions, logs `ACCOUNT_DELETION_REQUESTED`; `middleware.ts:57` gates the account during the grace
  window; `/restore` undoes it; and **`apps/api/src/jobs/accountPurgeJob.ts` hard-deletes** users whose
  `deletionRequestedAt` is older than 30 days. Copy: *"Permanently removes your matches, chats, bookings,
  and profile after a 30-day grace window."* ✓
- **Consent ledger** — `gdpr.ts` `POST/GET/DELETE /consent`, recording `ipAddress`, `userAgent`,
  `consent_version`, `consent_given` with timestamps (types: PRIVACY_POLICY, TERMS, MARKETING_EMAILS,
  DATA_SHARING, COOKIE_TRACKING, ML_TRAINING). ✓

**Operator-verify:** the purge job (`accountPurgeJob.ts`) **exists** — confirm it is actually **scheduled
and running**, and that its hard-delete cascades to **Mongo (`profiles_content`) + Redis** as well as
Postgres (PG child tables clear via FK cascade). Also confirm general **retention** limits (Privacy §8)
are enforced (only `0033_virtual_dates_retention` was found for automated retention).

---

## 6. SEO — PASS

- **No global noindex regression.** Root `apps/web/src/app/layout.tsx:43` → `robots: { index: true,
  follow: true }`. Private pages carry per-page `index:false`: `profiles/[profileId]:258`, `feed:76`,
  `nri:53`, `register/login:12`, `ui-preview:7`. Marketing home indexable (`(marketing)/page.tsx:27`).
- **robots** `apps/web/src/app/robots.ts` — `allow: '/'`, disallows `/admin /feed /profiles/ /chat/
  /api/ /actions/ /dashboard/ /onboarding/ /settings/ /account`, references sitemap + host.
- **sitemap** `apps/web/src/app/sitemap.ts` — static routes + 22 programmatic SEO routes, each with
  `hreflang` alternates (`en-IN` / `hi-IN`). ✓

---

## 7. Launch Checklist State

Authoritative source: `docs/launch/LAUNCH-CHECKLIST.md` — **🔴 NO-GO (2026-06-16)**, blocked on external
registrations (A1 Razorpay, A2 MSG91 DLT, A3 legal) + verify-at-flip items.

### (a) 44 seeded QA accounts — P1, verify + purge
`packages/db/seed/test-accounts.ts` seeds exactly **44** accounts: `COUNTS = { INDIVIDUAL 22,
FAMILY_MEMBER 6, VENDOR 9, EVENT_COORDINATOR 3, ADMIN 2, SUPPORT 2 }`. Tagged `user.id LIKE 'qa-%'`,
phone `+9170000000xx`, email `<id>@qa.smartshaadi.test`. **No prod guard** — the script runs against
whatever `DATABASE_URL` is set (no `NODE_ENV`/prod-URL refusal); the "LOCAL ONLY" note is a comment only.
Includes **2 ADMIN + 2 SUPPORT** rows (`status:'ACTIVE'`, verified) loginable via `MOCK_OTP_VALUE` while
`USE_MOCK_SERVICES=true`.
- **Mitigated at launch** (master flip removes `MOCK_OTP_VALUE` + sets `USE_MOCK_SERVICES=false`), but the
  accounts should **not exist in prod at all**.
- **Operator-verify:** `SELECT count(*) FROM "user" WHERE id LIKE 'qa-%';` on prod → if > 0, purge via
  `pnpm --filter @smartshaadi/db db:seed:test-accounts:remove`. (P0 if present while mock OTP is live.)

### (b) DNS Hostinger → Cloudflare (`media.smartshaadi.co.in`) — P2 mismatch
Mobile defaults media to the custom domain: `apps/mobile/src/lib/env.ts:17` →
`EXPO_PUBLIC_MEDIA_URL ?? 'https://media.smartshaadi.co.in'`. But **API prod env still points at the raw
bucket**: `apps/api/.env.production:35` → `CLOUDFLARE_R2_PUBLIC_URL=https://smartshaadi-media.r2.cloudflarestorage.com`
(not the custom domain). Note that photos are served via **short-lived presigned R2 URLs**
(`apps/api/src/storage/service.ts`, ~900s expiry), so `CLOUDFLARE_R2_PUBLIC_URL` mainly affects any
direct `media.smartshaadi.co.in` references (e.g. the mobile default) rather than the primary photo
path. Verify the custom-domain cutover is live and align the API prod `CLOUDFLARE_R2_PUBLIC_URL`, or
media URLs diverge between web/api and mobile.

### (c) `AI_SERVICE_HEALTH_URL` — resolved (re-confirm)
Not a code artifact (code uses `AI_SERVICE_URL`, default `localhost:8000`, env-overridden —
`apps/api/src/lib/env.ts:146`). `LAUNCH-CHECKLIST.md` **A5 = 🟢 DONE — re-confirm** (set in Railway
2026-06-07). Operator to re-confirm it is still set and targets the internal Railway address before
launch.

### (d) `MIGRATIONS-PENDING.md` — P2, stale/incomplete
The file documents applied state only **through 0029** (drift reconciled 2026-06-07, matching A4). But
forward migration files **0030–0039 exist** (`packages/db/migrations/`), including **`0032_financial_shells`,
`0034_nri_international`, `0037_phase8_supply_services`, `0038_marketing_cities_registry`,
`0039_supply_city_registry_link`) — their **prod apply-state is undocumented**. Two stale headers
(`## 0027 … PENDING`, lines 167 & 179) are **contradicted** by the later "APPLIED 2026-06-01" log — a
grep for "PENDING" gives a false positive. **Operator-verify** `__drizzle_migrations` high-water ≥ 0039
on prod; update the doc.

### (e) Hardcoded localhost reachable in a prod build — P1/P2
`process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'` appears in **~45 web files** plus
`apps/web/src/middleware.ts:64` (every request's session check) and all payment/admin pages. It is a
**soft fallback with no build-time guard** — if `NEXT_PUBLIC_API_URL` is unset at build, the client
bundle ships pointing at `localhost:4000`. (`NEXT_PUBLIC_SITE_URL` default `https://smartshaadi.co.in`
is fine; `AI_SERVICE_URL` default `localhost:8000` is server-side.) By contrast the API's own CORS
localhost origins (`apps/api/src/lib/cors.ts:34-39`) are correctly **`NODE_ENV`-guarded** (dev-only) —
so the client `NEXT_PUBLIC_API_URL` fallback is the one exposure without a guard. **Operator-verify**
Vercel prod sets `NEXT_PUBLIC_API_URL`; consider failing the build when it is missing.

### Secrets hygiene — PASS (no leak)
`apps/api/.env.production` holds real prod secrets (auth/JWT/R2/Razorpay/MSG91/DigiLocker) but is
**correctly gitignored** (`.gitignore:36`) and **not tracked** (verified via `git ls-files` /
`git check-ignore`). No `.env` with secrets is committed.

---

## 8. i18n — Hindi + English Parity — PASS

`apps/web/messages/en.json` vs `hi.json`: **key parity is perfect — 0 missing, 0 extra, identical count
in both locales** (~3,500 keys counting nested objects; ~3,620 if array items such as the legal
`sections[]` are counted individually — the parity conclusion is the same either way). Only ~**15–20**
values are identical across locales, and all are legitimately non-translatable: brand ("Smart Shaadi
Premium"), placeholder/format strings (`{score}/36`, `{percent}%`, char counters), and tokens ("GSTIN",
"SMS", "KYC", HSN/SAC + phone/email placeholders). The lending/insurance regulatory disclosures are
**fully translated to Hindi** (verified). No missing-key gap; untranslated coverage ~0.5%.

**Note (mobile):** `apps/mobile` has **no i18n setup at all** — no `en.json`/`hi.json` catalog and no
i18n library; strings are hardcoded English. If mobile must ship bilingual, this is net-new work
(implement e.g. next-intl-equivalent for RN, or document as English-only MVP).

---

## Requires operator / prod verification (cannot be confirmed read-only from code)

1. **QA accounts in prod?** `SELECT count(*) FROM "user" WHERE id LIKE 'qa-%';` — purge if > 0.
2. **Migrations 0030–0039 applied to prod?** Check `__drizzle_migrations` high-water ≥ 0039.
3. **`media.smartshaadi.co.in`** custom domain live + API prod `CLOUDFLARE_R2_PUBLIC_URL` updated to it.
4. **`AI_SERVICE_HEALTH_URL`** still set in Railway and targeting the internal address (A5 re-confirm).
5. **Vercel prod** has `NEXT_PUBLIC_API_URL` (+ `NEXT_PUBLIC_SITE_URL`) set (no localhost fallback shipped).
6. **Actual Railway `USE_MOCK_SERVICES`** value — staging config shows `true`; must be `false` before any
   real user transacts (payments/OTP honesty).
7. **Deletion purge job** — confirm the 30-day account purge runs and cascades Postgres + Mongo + Redis.

## Clean passes (no action)

i18n en/hi parity · SEO (no global noindex, robots + sitemap correct) · lending regulatory copy
(RBI 2025) · GDPR/DPDP export + delete + consent ledger · B2B invoice branding · Ashwin's title.
