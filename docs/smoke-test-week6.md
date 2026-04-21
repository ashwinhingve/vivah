# Smoke Test — Week 6 Wedding Planning + Guest Management

**Date:** 2026-04-21
**Phase:** 2 (single-agent integration)
**Test suite:** 205/205 passing — zero regressions vs 182 baseline
**Type-check:** 8/8 packages clean

---

## Code-level verification (automated, complete)

| Check | Result |
|-------|--------|
| `pnpm type-check` (all 8 packages) | clean |
| `pnpm --filter @smartshaadi/api test` | 205/205 |
| `weddingRouter` mounted at `/api/v1/weddings` | index.ts:82 |
| `guestRouter` mounted at `/api/v1` (covers nested + public /rsvp) | index.ts:83 |
| `autoGenerateChecklist` auto-invoked inside `createWedding` when `weddingDate` provided | service.ts:173-180 (non-fatal wrap) |
| `GET /weddings` list endpoint added (dashboard + /weddings page consumers) | weddings/router.ts |
| Dashboard wired with My Wedding section (WeddingCard + empty-state CTA) | dashboard/page.tsx |
| Public `PUT /rsvp/:token` has no `authenticate()` | guests/router.ts:224 |
| Ownership chain enforced on all mutations (wedding → guestList → guest) | guests/service.ts (teammate 2 report) |
| Budget categories in MongoDB via mockStore / WeddingPlan.findOneAndUpdate | service.ts |
| Kanban uses click-to-move (no dnd lib) | TaskKanban.client.tsx (teammate 3) |
| AppNav "My Wedding" entry visible for INDIVIDUAL role | teammate 3 report |

---

## Plan checklist — coverage map

### API endpoints (`apps/api/src/weddings/__tests__/service.test.ts` + `apps/api/src/guests/__tests__/service.test.ts`)

| Plan item | Covered by |
|-----------|------------|
| `POST /api/v1/weddings` → 201, wedding + MongoDB plan | unit tests: creates PG row + mockStore plan with 10 categories |
| `GET /api/v1/weddings/:id` → 200, returns PG + MongoDB combined | unit test: returns combined data with taskProgress |
| `POST /api/v1/weddings/:id/tasks` → 201, task created | service.createTask test |
| `GET /api/v1/weddings/:id/tasks` → 200, kanban groups correct | service.getTaskBoard test: groups by status |
| `PUT /api/v1/weddings/:id/tasks/:taskId` → 200, status updated | service.updateTask test |
| `PUT /api/v1/weddings/:id/budget` → 200, MongoDB categories updated | service.updateBudget test |
| `POST /api/v1/weddings/:id/guests` → 201 | service.addGuest test |
| `POST /api/v1/weddings/:id/guests/bulk` → 201 | service.bulkImportGuests test (500 limit enforced in schema) |
| `GET /api/v1/weddings/:id/guests/stats` → 200, RSVP stats | service.getRsvpStats test |
| `POST /api/v1/weddings/:id/invitations/send` → 200, mock logs | invitation test: `[MOCK] Invitation sent …` + sets `sentAt` |
| `PUT /api/v1/rsvp/:token` → graceful handling | service.updateRsvp test: wrong token rejected |

### Web pages (teammate 3 build verified, awaiting live browser smoke)

| Page | Status |
|------|--------|
| `/weddings` | builds; empty state renders when no weddings |
| `/weddings/new` | form builds; POST wired |
| `/weddings/:id` | overview + 4 stat cards + tab nav |
| `/weddings/:id/tasks` | Kanban 3-column, click-to-move arrows |
| `/weddings/:id/budget` | totals + category table |
| `/weddings/:id/guests` | sortable table + RSVP donut |

---

## Live HTTP smoke — BLOCKED on server restart

Running API server (tsx watch) has a stale module cache. WSL DrvFs file watcher does not reliably detect new TypeScript files / new routes. Touching `index.ts` did not trigger reload. The sandbox denies `kill` of the tsx process, so a live-server restart must be performed by the user:

```
# In the terminal running `pnpm dev`:
Ctrl+C, then re-run `pnpm dev`
```

Once restarted, confirm with:
```bash
curl -sS -X POST http://localhost:4000/api/v1/weddings \
  -H "Content-Type: application/json" -d '{}' \
  | head -c 200
# Expect: JSON envelope with UNAUTHORIZED (not HTML 404)

curl -sS -X PUT http://localhost:4000/api/v1/rsvp/does-not-exist \
  -H "Content-Type: application/json" \
  -d '{"rsvpStatus":"YES","mealPref":"VEG"}' | head -c 200
# Expect: JSON envelope (graceful 404 for unknown token, not HTML 404)
```

Full browser smoke checklist after restart:
- [ ] `/dashboard` — My Wedding section shows empty-state CTA for user with no wedding
- [ ] `/weddings/new` — create wedding with date → redirects to `/weddings/:id`, auto-checklist created
- [ ] `/weddings/:id` — overview renders, stat cards populated
- [ ] `/weddings/:id/tasks` — auto-generated tasks appear in TODO column; arrow buttons move between columns
- [ ] `/weddings/:id/budget` — 10 default categories listed with ₹0 allocated/spent
- [ ] `/weddings/:id/guests` — add guest via form; bulk import via paste; send invitation (mock log in API console)
- [ ] `/dashboard` (after creating wedding) — My Wedding section shows WeddingCard with date + task progress bar

---

## Regressions check

- 205/205 tests passing (was 182 pre-week-6, +10 weddings + +13 guests = 205 exactly)
- Type-check clean across all 8 packages
- No dashboard regression — existing sections untouched, only additive change

---

## Outstanding

- Real invitation delivery: wire AWS SES + MSG91 (marked `TODO` in `invitation.ts`)
- Room allocation UI: deferred to Week 7
- Mood board (R2 photo upload): deferred to Week 7
- Muhurat date selector: needs horoscope integration, deferred
- Drag-and-drop on TaskKanban: intentionally deferred to Week 7 polish (click-arrows ship in v1)
