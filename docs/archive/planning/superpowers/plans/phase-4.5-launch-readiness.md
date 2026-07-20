# Phase 4.5 · Launch Readiness & Hardening

> Drop into `docs/superpowers/plans/phase-4.5-launch-readiness.md`
> **Status assumption:** Live on smartshaadi.co.in, production-stable, **not publicly launched.** Contract materially complete (25/26 + 11/11 + 9/9 + 4 bonus, 959 tests, 25 migrations).
> **This phase is the gate to public launch.** It is hardening + one owed feature + swap-readiness. **No new verticals. No premium spend.**

---

## 0. Constraints (read before touching anything)

- **Mocks stay ON.** Colonel's merchant/SMS/KYC registrations are not done. Production keeps `USE_MOCK_SERVICES=true`, `MONGO_LIVE=true`, `R2_LIVE=true`, `ALLOW_MOCK_SERVICES_IN_PROD=true`. We *prepare* the real swap; we do not execute it.
- **Cost ceiling: keep total stack < $15/mo.** No M10, no read replicas, no second region, no pgBouncer bump. Nothing in this phase costs incremental money — it's all code on the current stack.
- **Don't break what works.** Especially: auth middleware, the mock-flag system, i18n `[locale]` routing, the database schema. Touch these only where a fix explicitly requires it, and re-run the full suite + browser verification after.
- **Unfunded continuation.** Colonel said continue but won't pay for this. Spend time where it converts to launch + rev-share, not on speculative polish.
- **Verification protocol is non-negotiable** (from `CLAUDE.md`): code is not "verified" until (1) `pnpm type-check` passes, (2) `pnpm build` passes, (3) affected pages opened in a browser, (4) key interactions clicked, (5) network tab shows no 500s from Server Components, (6) console shows no React errors. Type-check + build alone is NOT verification for Server Components.
- **Ops splits:** push from PowerShell (WSL lacks git creds); run DB/psql/scripts from the shell that can reach Railway (handoff says WSL works after proxy fix, else PowerShell); don't mix GitHub login (`ashwin.hingave123`) with Vercel login (`smartshaadiofficial`).
- **The 12 architecture rules apply** (repo `CLAUDE.md`, not the 10-rule handoff copy). Rule 11 = guard every Mongo-touching service with `USE_MOCK_SERVICES`/`MONGO_LIVE` or it buffers 10s and crashes. Rule 12 = resolve `userId → profileId` before any profile-keyed query.

---

## 1. Objectives & exit gates

Phase 4.5 is done — and public launch is unblocked — when **all** of these are true:

1. **Every P0 security item in `docs/phase1-2-code-review.md` is audited and closed** (or confirmed already-fixed). The SSRF and the global `profileId` socket broadcast are hard launch blockers.
2. **The `:profileId` non-UUID crash is fixed** with error-handler middleware (currently an unhandled Postgres uuid parse error crashes the API — a trivial DoS).
3. **Migration history is replayable.** A `0014` rollup captures the ad-hoc `fix-schema-drift.sql` state; a fresh DB built from migrations alone reproduces prod; root ad-hoc scripts retired.
4. **Digital Invitation Builder shipped** (Item 16, the deferred Phase 1–2 contract item).
5. **Mock→real swap is prepared but not executed:** webhook record/replay harness exists, per-provider swap runbook written, flag-matrix parity smoke test passes. Mocks remain ON.
6. **Eval harness runs in CI** over the 11 AI features; **branded `ProfileId` type** makes Rule-12 violations a compile error.
7. **Launch checklist green:** health curl-matrix, rate limiting on auth + sockets, legal pages (privacy/terms, DPDP-aligned), Sentry/PostHog/BetterStack sane, all 959 existing tests still passing.

---

## 2. Workstreams

### WS1 — Security hardening (P0) · complexity M · BLOCKS LAUNCH
The code review predates the May 21 "stable" handoff, so **start with an audit-and-confirm pass** — some may already be patched during demo-week fixes. For each, confirm current state, then close.

| # | File:line | Issue | Fix |
|---|---|---|---|
| 1 | `apps/api/src/chat/router.ts:557` | `/chat/link-preview?url=` **SSRF** — only blocks protocol + content-type, can fetch `169.254.169.254` metadata | Add RFC-1918 / link-local / loopback IP blocklist (resolve host, reject private ranges) before fetch |
| 2 | `apps/api/src/chat/socket/handlers.ts:54,88` | `presence_update` broadcasts `profileId` to **all** sockets globally | Scope to participant rooms only (`socket.to(matchRequestId)`) after room join |
| 3 | `handlers.ts:513` | `typing` emits raw Better Auth `userId` to peers | Strip `userId` from emitted payload — it never leaves the server boundary |
| 4 | `apps/api/src/matchmaking/engine.ts:447` | Candidate query has **no gender filter**; same-gender profiles surface | Add bilateral gender filter to query + `applyHardFilters` |
| 5 | `apps/api/src/matchmaking/requests/service.ts:237` | `acceptRequest` read-then-write, no status guard → concurrent accepts double-write + duplicate Chat doc | Add `and(eq(status,'PENDING'))` to UPDATE WHERE; check rows-affected, 409 on 0 |
| 6 | `requests/service.ts:691` | `declineReason` returned in **sender's** view (was moderation-internal) | Null `declineReason` when `side=sent` |
| 7 | `handlers.ts:460,481` | `delivered_ack`/`mark_read` accept unbounded client `messageIds` → `$in` | Zod-validate, cap at 100 |
| 8 | `apps/api/src/chat/router.ts:595` | `report` embeds raw `reason` into messages array → stored XSS risk | Separate `reports` collection; never inline into chat |
| 9 | `apps/api/src/kyc/audit.ts` | Audit write not in txn — audit failure 500s after KYC state committed | Wrap state update + audit write in one `db.transaction` |
| 10 | `apps/api/src/chat/socket/index.ts:49` | `attachRedisAdapter` fire-and-forget → multi-instance message loss; no socket rate limiting | `await` adapter attach before accepting connections; add per-socket throttle on `send_message`/`typing`/`join_room` |
| 11 | `shortlists/service.ts:228` vs `engine.ts` | Mongo key mismatch (`{profileId}` vs `{userId}`) → silent null in prod | Standardise the key across both readers |
| 12 | `requests/service.ts:296,334` | `const userId = callerProfileId` — the exact Rule-12 anti-pattern, in code | Remove the misleading alias |

> Items 2, 3, 6, 11 are privacy/PII leaks. Items 1, 7, 8 are attack surface. Item 4 is a trust-breaking correctness bug for an arranged-marriage product. Items 5, 9 are consistency races.

### WS2 — Data integrity / migration rollup · complexity M
- Generate `0014_phase4_drift_rollup.sql` capturing the cumulative `fix-schema-drift.sql` v2 state (the 76 columns / 7 tables / 3 enums / 6 indexes the May 11 audit documented), so `packages/db/migrations/*.sql` becomes canonical replay history again.
- Mark it already-applied on prod (`INSERT INTO __drizzle_migrations (hash, created_at) …`) so the runner doesn't re-execute it. Do this carefully, from the shell that reaches Railway, after a backup.
- Verify replay: build a throwaway Postgres, run migrations `0000→0014` only, diff `\d` against a prod table snapshot. They must match.
- Retire root ad-hoc scripts (`fix-age-prefs.js`, `apply-schema-fix.js`, `audit-all-schema.js`, `fix-schema-drift.sql`, etc.) to `scripts/incident-response/2026-05-08/` and reference them in a runbook.
- Going forward, lock the discipline: `db:generate` → hand-edit for idempotency (`CREATE … IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`) → update `_journal.json` if hand-written → `psql -f` apply → explicit verify. **Never `db:push` to prod.**

### WS3 — Digital Invitation Builder (owed Item 16) · complexity M · P0 contract
Build on the existing `invitations` + guest/RSVP plumbing — do **not** duplicate it.
- **User story:** A couple picks an e-invite template, fills names / dates / chosen Muhurat / venue / ceremony list, gets a shareable link + a rendered image/PDF asset, shares via WhatsApp, and RSVPs flow into the existing guest system.
- **Build:** template components on the locked design tokens (Burgundy/Gold/Teal/Ivory, Playfair + Inter); Server Actions for all mutations (Rule 3); rendered asset stored in R2 via pre-signed URL (Rule 6); WhatsApp share as a deep link (mock-safe — no API send needed for sharing a link); en/hi via existing next-intl; mobile-first 375px, 44px touch targets.
- **Acceptance:** shareable link renders the invite for an unauthenticated guest; RSVP writes to the existing guest table; `userId → profileId` resolved at every boundary (Rule 12); asset never streamed through the API.

### WS4 — Mock→Real swap readiness (PREPARED, NOT EXECUTED) · complexity M
Mocks stay on. This makes the eventual flip a 30-minute, low-fear operation instead of the demo-week scramble.
- **Webhook record/replay harness:** the hard part of payments/eSign/SMS is *inbound* callbacks, not outbound calls. Build a harness that stores a canonical payload per provider (Razorpay payment + webhook, MSG91 delivery, DigiLocker eSign callback) and replays it against the handler in tests. Capture the real shapes from each provider's docs now; capture live samples the day creds land.
- **Flag-matrix parity smoke test:** flag mismatches between read and write paths broke ProfileContent reads during demo week. Add a test that asserts, for each relevant combination of `USE_MOCK_SERVICES` / `MONGO_LIVE` / `R2_LIVE`, that read and write paths agree (both mock or both live for a given store).
- **Per-provider swap runbook:** exact env-var changes + verification curl per provider (Razorpay, MSG91, DigiLocker), in dependency order, with rollback. File at `docs/launch/mock-to-real-swap.md`.

### WS5 — AI-first foundations · complexity S–M
- **Eval harness in CI:** golden-set regression tests for the 11 AI features, routed through Helicone (already wired via `HELICONE_API_KEY`). Use promptfoo or a small custom harness; assert structure + key behaviors (e.g., Conversation Coach never leaks the other party's private content; DPI stays user-visible only). Wire into GitHub Actions. This is the missing piece for calling the product "AI-first."
- **Branded `ProfileId` type:** add to `packages/types`; make repositories accept only `ProfileId`, so passing a `userId` is a compile error. This kills the Rule-12 bug class structurally instead of by reminder.
- **(Optional, cheap) prompt-cache** the long system prompts on the Sonnet-backed features to cut token cost — only if Helicone shows it matters.

### WS6 — Launch checklist · complexity S
- **`:profileId` UUID guard:** add validation/error-handler middleware so a non-UUID path segment returns 400, not an unhandled crash (the bug `CLAUDE.md` flagged for Week 9).
- **Rate limiting:** confirm auth routes and socket events are throttled (Redis counters already exist for `rate_limit:{ip}:{route}`).
- **Legal pages:** privacy policy + terms, DPDP-aligned, linked in footer. Required before public launch.
- **Health curl-matrix:** scripted check across api/ai-service/web after every deploy.
- **Observability sanity:** Sentry release tag `phase-4.5`, PostHog capturing, BetterStack monitors green. Drop `SENTRY_TEST_ENABLED` post-launch.
- **Light load smoke only:** k6 at modest RPS to catch obvious regressions — not capacity planning. No infra spend.

---

## 3. Roadmap (solo-realistic)

| Week | Focus | Gate |
|---|---|---|
| W1 | WS1 security audit-and-close (all 12 items) + WS6 UUID guard | All P0 closed; full suite green; browser-verified |
| W2 | WS2 migration rollup + DR replay verification + retire root scripts | Migrations replay clean on scratch DB |
| W3 | WS3 Digital Invitation Builder | E2E: build → share link → guest RSVP |
| W4 | WS4 swap-readiness + WS5 evals + WS6 launch checklist | Swap runbook + flag-parity test + eval CI green; launch checklist complete |

Single-agent sequential by default. The only safe worktree split is W3 (Invitation Builder, frontend-heavy) running parallel to a tail of W1/W2 api work **only if** file ownership is truly disjoint — otherwise stay sequential.

---

## 4. Sub-agent roles (functional — no people)

Default mode is **single agent, sequential, atomic commits.** Use worktrees only when two tasks have zero file overlap (per your handoff).

- **Contracts/Schema Agent** — types, Zod schemas, Drizzle migrations, ADRs. Used in WS2, WS3, WS5.
- **Security-Hardening Agent** — owns WS1; touches `apps/api/src/{chat,matchmaking,kyc}`. Forbidden: behavior changes to auth middleware beyond adding validation; touching the mock-flag system.
- **Backend Agent** — Node/Express modules, Bull queues, Mongo repositories. Used in WS3, WS4.
- **Frontend Agent** — Next.js App Router, Server Actions, shadcn, design tokens, i18n. Owns WS3 UI.
- **AI/Eval Agent** — `apps/ai-service`, eval harness, Helicone routing. Owns WS5.
- **Integration/QA Agent** — mounts routes, runs smoke + e2e + the verification protocol, updates `ROADMAP.md`/`CLAUDE.md`.

---

## 5. Claude Code prompts (your Tier-N format · paste-ready)

### Prompt A — WS1 Security hardening sweep
```
Tier 1 — P0 security hardening sweep.

Context: Smart Shaadi is production-stable but not publicly launched. docs/phase1-2-code-review.md
lists P0 security/correctness issues across chat, matchmaking, and kyc. Some may already be fixed
since that review. Audit each, then close the open ones. This blocks public launch.

Working directory: /mnt/d/Do Not Open/vivah/vivahOS
Branch: feat/45-security-hardening from main

Single agent task — sequential, atomic commits (one commit per fix).
Three-line plan, then implement. NO plan approval mode.

For each item: first confirm current state in code, then fix if open.
1. chat/router.ts:557 — /chat/link-preview SSRF: add private/link-local/loopback IP blocklist
   (resolve host, reject RFC-1918 + 169.254.0.0/16 + ::1 + fc00::/7) BEFORE fetch. Test: metadata IP rejected.
2. chat/socket/handlers.ts:54,88 — presence_update: scope to socket.to(matchRequestId), never global broadcast.
3. handlers.ts:513 — typing event: remove userId from emitted payload.
4. matchmaking/engine.ts:447 — add bilateral gender filter to candidate query AND applyHardFilters. Test: same-gender excluded.
5. requests/service.ts:237 — acceptRequest: add and(eq(status,'PENDING')) to UPDATE WHERE; 409 if rows-affected=0. Test: concurrent accept.
6. requests/service.ts:691 — null declineReason when side=sent.
7. handlers.ts:460,481 — Zod-validate messageIds, cap 100.
8. chat/router.ts:595 — move report reason to a separate reports collection; stop inlining into chat messages.
9. kyc/audit.ts — wrap KYC state update + audit write in one db.transaction.
10. chat/socket/index.ts:49 — await attachRedisAdapter before accepting connections; add per-socket rate limit on send_message/typing/join_room.
11. shortlists/service.ts:228 vs engine.ts — standardise the Mongo doc key (pick one of profileId/userId, use everywhere).
12. requests/service.ts:296,334 — remove the misleading `const userId = callerProfileId` alias.

ENFORCEMENT:
- DO NOT change auth middleware behavior (only add input validation).
- DO NOT touch the mock-services flag system, i18n routing, or schema.
- All 959 existing tests must still pass. Add tests for items 1,4,5,7.
- Type-check clean, build clean.
- Verify: open chat + match feed locally, click through, network tab no 500s, console clean.

WHEN DONE: table of each item → {already-fixed | fixed} + file:line + test added.

NO plan approval mode. Implement directly.
```

### Prompt B — WS2 Migration rollup + DR
```
Tier 1 — migration history rollup + DR replay.

Context: Prod was patched via ad-hoc fix-schema-drift.sql, bypassing the generate→commit→run flow
(see docs/audits/schema-audit-2026-05-11.md). A fresh DB from migrations alone may NOT reproduce prod.
Make migrations canonical again and prove replay.

Working directory: /mnt/d/Do Not Open/vivah/vivahOS
Branch: feat/45-migration-rollup from main

Single agent task — sequential, atomic commits.
Three-line plan, then implement. NO plan approval mode.

1. Generate 0014_phase4_drift_rollup.sql capturing the cumulative fix-schema-drift.sql v2 state
   (76 cols / 7 tables / 3 enums / 6 indexes). Idempotent: ADD COLUMN IF NOT EXISTS, ADD VALUE IF NOT EXISTS.
2. Update packages/db/migrations/meta/_journal.json for the hand-written migration.
3. Write docs/launch/dr-replay-verification.md: spin a scratch Postgres, run 0000→0014 only,
   diff \d output vs a prod table snapshot for: profiles, kyc_verifications, vendors, match_requests,
   guests, ceremonies, invitations, notification_preferences. Must match.
4. Move root ad-hoc scripts (fix-age-prefs.js, apply-schema-fix.js, audit-all-schema.js,
   fix-schema-drift.sql, etc.) to scripts/incident-response/2026-05-08/ and add a README pointing to them.

ENFORCEMENT:
- NEVER emit a destructive ALTER on Better Auth PK columns (the drizzle 42P16 hazard).
- Back up before any INSERT into __drizzle_migrations on prod; run prod ops from the shell that reaches Railway.
- DO NOT run db:push against prod, ever.
- Type-check clean. Existing tests pass.

WHEN DONE: paste the scratch-DB replay diff result + list of moved scripts.

NO plan approval mode. Implement directly.
```

### Prompt C — WS3 Digital Invitation Builder
```
Tier 1 — Digital Invitation Builder (deferred contract Item 16).

Context: Couples need to create a shareable digital wedding invite. The guest/RSVP/invitations
plumbing already exists — build the BUILDER on top of it, do not duplicate RSVP logic.

Working directory: /mnt/d/Do Not Open/vivah/vivahOS
Branch: feat/45-invitation-builder from main

Single agent task — sequential, atomic commits.
Three-line plan, then implement. NO plan approval mode.

1. Read packages/db/schema (invitations + guests tables) and apps/web wedding route group first; report what exists.
2. Add e-invite template definitions + any needed columns via a proper migration (generate, idempotent, journal).
3. Server Actions (NOT API routes) for create/update/publish invite. Resolve userId→profileId at every boundary.
4. Template components on design tokens (Burgundy #7B2D42 / Gold #C5A47E / Teal #0E7C7B / Ivory #FEFAF6;
   Playfair headings + Inter body). Fields: couple names, dates, chosen Muhurat, venue, ceremony list.
5. Render a shareable asset (image or PDF) to Cloudflare R2 via pre-signed URL — never stream through the API.
6. Public shareable link renders the invite for an UNauthenticated guest; RSVP writes to the existing guest table.
7. WhatsApp share = deep link to the public URL (mock-safe, no API send needed).
8. en/hi via next-intl. Mobile-first 375px, 44px touch targets, page bg Ivory (never white).

ENFORCEMENT:
- Server Actions for all mutations (Rule 3). R2 pre-signed only (Rule 6). Rule 12 everywhere.
- DO NOT touch auth, mock-flags, or unrelated schema.
- Tests for link generation + RSVP write. Type-check + build clean.
- Verify: build an invite, open the public link in a logged-out browser, submit RSVP, confirm it lands in guests. Network tab no 500s.

WHEN DONE: report new routes, new/changed tables, and the verification walkthrough.

NO plan approval mode. Implement directly.
```

### Prompt D — WS5 Eval harness + branded ProfileId
```
Tier 1 — AI eval harness + branded ProfileId type.

Context: 11 AI features ship with no regression evals, and the userId→profileId bug recurs.
Add an eval gate and make the bug a compile error.

Working directory: /mnt/d/Do Not Open/vivah/vivahOS
Branch: feat/45-eval-and-profileid from main

Single agent task — sequential, atomic commits.
Three-line plan, then implement. NO plan approval mode.

1. Add a branded ProfileId type in packages/types (e.g. type ProfileId = string & { __brand: 'ProfileId' }).
   Update the profile-keyed repository signatures to accept ProfileId only. Fix resulting type errors by
   resolving userId→profileId at the boundary. A raw userId passed to a profile-keyed query must NOT compile.
2. Build an eval harness (promptfoo or small custom) with golden sets for the 11 AI features, routed through
   Helicone (HELICONE_API_KEY already set, ASSISTANT_MODEL=claude-sonnet-4-6). Assert structure + key safety
   behaviors (Conversation Coach must not echo the other party's private content; DPI stays user-visible only).
3. Wire the eval suite into .github/workflows as a CI job (non-blocking warn first, then required).

ENFORCEMENT:
- DO NOT change AI feature behavior — only add the type and the eval scaffolding.
- All existing tests pass. Type-check + build clean.

WHEN DONE: report files changed, any places where userId was being passed as profileId (now fixed), and the eval CI job name.

NO plan approval mode. Implement directly.
```

---

## 6. SOPs

- **Migration apply:** `pnpm --filter @smartshaadi/db db:generate` → hand-edit idempotent → update `_journal.json` if hand-written → `psql "$DATABASE_URL" -f packages/db/migrations/NNNN_*.sql` from the shell that reaches Railway → verify with explicit `psql -c "SELECT …"`. Never `db:push` to prod.
- **Push/merge:** from PowerShell — `git push origin BRANCH`; merge `--no-ff` to main; wait 3–5 min for Vercel + Railway redeploys; run health curl-matrix.
- **Verification protocol:** type-check → build → browser → click → network tab (no 500s) → console (no errors). Mandatory for any Server Component change.
- **Mock→real swap (later):** follow `docs/launch/mock-to-real-swap.md` in dependency order, one provider at a time, verify curl after each, rollback on failure.

---

## 7. QA / testing

- All **959** existing tests stay green — this is a release gate, not a suggestion.
- New 100% coverage targets: SSRF IP blocklist, gender filter, accept-request race, `messageIds` cap, UUID guard middleware, invitation link generation, webhook HMAC/replay, eval assertions.
- Manual: full verification protocol on chat, match feed, and invitation flows.

---

## 8. Risks (top 8)

1. **Regression in auth / mock-flags / i18n while fixing security** → only touch in-scope files; full suite + browser verify after each commit. Highest-probability self-inflicted risk.
2. **Migration rollup error on prod `__drizzle_migrations`** → backup first, dry-run on scratch DB, mark-applied carefully from the Railway-reachable shell.
3. **Scope creep into Phases 5–8** → 4.5 is hardening + Item 16 only; defer everything else.
4. **Anthropic billing flag** (handoff notes a billing issue, balance positive) → monitor; evals add modest token spend, keep them small.
5. **WSL Node fetch / DNS quirks** breaking the SSRF resolver tests → run those tests / scripts from PowerShell.
6. **Stored-XSS fix changes report shape** consumed by admin UI → update admin reader in the same PR.
7. **Socket adapter `await` change alters connect timing** → verify reconnection + presence after deploy on two instances.
8. **Cost creep** from "while we're here" infra ideas → hard $15/mo ceiling; nothing in 4.5 spends.

---

## 9. Exit → launch

When 4.5 exit gates are green **and** Colonel's registrations land: run `docs/launch/mock-to-real-swap.md` provider-by-provider, flip the LIVE flags, re-verify, then public launch. **Phase 5 begins only after launch.**

Incremental cost of this entire phase: **$0.**
