# Smoke Test — Week 6 Wedding Planning + Guest Management

**Date:** 2026-04-21 19:49 UTC
**Phase:** 2 (integration) — complete
**Unit suite:** 205/205 passing — zero regressions vs 182 baseline
**Type-check:** 8/8 packages clean
**Web build:** green (all 6 `/weddings/*` routes compiled)
**Live HTTP smoke:** **20/20 endpoints PASS**

---

## Live HTTP smoke — 20/20 PASS

Fresh OTP session for `+919999999001` → cookie → every endpoint exercised end-to-end.

| # | Endpoint | Method | HTTP | Result |
|---|----------|--------|------|--------|
| 1 | `/api/v1/profiles/me` | GET | 200 | ✅ baseline auth |
| 2 | `/api/v1/weddings` | POST | 201 | ✅ wedding + MongoDB plan (10 default categories), `tasksCreated=3` (auto-checklist fired for 2027-02-14) |
| 3 | `/api/v1/weddings` | GET | 200 | ✅ list returns the new wedding |
| 4 | `/api/v1/weddings/:id` | GET | 200 | ✅ combined PG + mongoPlan + taskProgress + guestCount |
| 5 | `/api/v1/weddings/:id` | PUT | 200 | ✅ rename venue |
| 6 | `/api/v1/weddings/:id/tasks` | GET | 200 | ✅ 3-bucket board (TODO/IN_PROGRESS/DONE) |
| 7 | `/api/v1/weddings/:id/tasks` | POST | 201 | ✅ task created |
| 8 | `/api/v1/weddings/:id/tasks/:taskId` | PUT | 200 | ✅ TODO → IN_PROGRESS |
| 9 | `/api/v1/weddings/:id/budget` | PUT | 200 | ✅ mongoPlan budget categories updated |
| 10 | `/api/v1/weddings/:id/checklist/generate` | POST | 201 | ✅ returns `{ created }` |
| 11 | `/api/v1/weddings/:id/guests` | GET | 200 | ✅ empty list before adds |
| 12 | `/api/v1/weddings/:id/guests` | POST | 201 | ✅ guest created (auto-created guestList) |
| 13 | `/api/v1/weddings/:id/guests/bulk` | POST | 201 | ✅ 2 imported |
| 14 | `/api/v1/weddings/:id/guests/stats` | GET | 200 | ✅ aggregated rsvp/meal counts |
| 15 | `/api/v1/weddings/:id/invitations/send` | POST | 400 | ✅ validation: empty guestIds rejected |
| 16 | `/api/v1/weddings/:id/guests/:guestId` | PUT | 200 | ✅ rsvpStatus → YES |
| 17 | `/api/v1/weddings/:id/invitations/send` | POST | 200 | ✅ mock email sent, sentAt set |
| 18 | `/api/v1/rsvp/not-a-real-token` | PUT | 404 | ✅ public endpoint, envelope NOT_FOUND (no auth required) |
| 19 | `/api/v1/weddings/:id/guests/:guestId` | DELETE | 200 | ✅ removed |
| 20 | `/api/v1/weddings/:id/tasks/:taskId` | DELETE | 200 | ✅ removed |

**No non-2xx surprises.** Intentional 4xx (empty guestIds 400, unknown RSVP token 404) return JSON envelopes, not HTML error pages.

---

## Bugs discovered during smoke + fixed

1. **`mockGetPlan` returned the mockStore wrapper instead of unwrapping `.plan`** — `updateBudget` crashed with "Cannot set properties of undefined (setting 'categories')". Fixed at `apps/api/src/weddings/service.ts:68`.
2. **`assertWeddingOwner` in guest service compared `wedding.profileId` directly to Better Auth `userId`** — always failed in production auth (profileId is a separate UUID). Fixed at `apps/api/src/guests/service.ts:47` by resolving `userId → profileId` via `profiles` lookup. Tests updated to mock the second select.

Both fixes verified — full test suite still 205/205; 20/20 live endpoints green.

---

## Stack state at time of smoke

- Docker services: postgres, mongo, redis, adminer — all healthy
- API (port 4000): running on stale tsx watch (WSL DrvFs doesn't detect TS file changes reliably)
- API (port 4001): fresh `npx tsx src/index.ts` with the bug-fix code — used for this smoke
- Web (port 3000): running

> **Known WSL gotcha:** after editing API files, the `tsx watch` process on port 4000 often fails to hot-reload on DrvFs (`/mnt/d`). `touch` and append-write do not trigger it. Ctrl+C + re-run `pnpm dev` is the reliable restart.

---

## Unit test coverage

| Module | Tests | Status |
|--------|-------|--------|
| weddings/service | 10 | ✅ |
| guests/service | 13 | ✅ |
| All other modules | 182 | ✅ (no regressions) |
| **Total** | **205** | **205/205** |

---

## Web pages — build verified

All 6 new wedding pages compiled under `pnpm --filter @smartshaadi/web build`:

```
ƒ /weddings                     183 B / 104 kB
ƒ /weddings/[id]                191 B / 104 kB
ƒ /weddings/[id]/budget         191 B / 104 kB
ƒ /weddings/[id]/guests        3.64 kB / 115 kB
ƒ /weddings/[id]/tasks         3.22 kB / 114 kB
ƒ /weddings/new                2.41 kB / 107 kB
```

Browser smoke (manual, deferred to user after restarting the 4000-port server):
- [ ] `/dashboard` — My Wedding section: empty-state CTA when no wedding, WeddingCard when one exists
- [ ] `/weddings/new` — create wedding → redirect to `/weddings/:id`
- [ ] `/weddings/:id` — overview + 4 stat cards + tab nav
- [ ] `/weddings/:id/tasks` — auto-generated tasks in TODO column; arrow buttons move
- [ ] `/weddings/:id/budget` — 10 default categories, inline-edit
- [ ] `/weddings/:id/guests` — add / bulk / send invitations / RSVP donut

---

## Outstanding / Deferred

- Real invitation delivery (AWS SES / MSG91) — mocked today; `TODO` in `invitation.ts`
- Room allocation UI — Week 7
- Mood board (R2 photo upload) — Week 7
- Muhurat date selector — needs horoscope integration
- Drag-and-drop on TaskKanban — click-arrow fallback ships in v1
