# Incident-response scripts — 2026-05-08 schema-drift event

One-off operational scripts written during the 2026-05-08 production
schema-drift incident and the related feed/preferences debugging. They were
previously parked at the repository root; moved here to keep the root clean and
to mark them as **historical, not part of the normal workflow**.

> **Do not run these against production casually.** They were written for a
> specific moment in time and hard-code test-user IDs and one-off fixes.

## What happened

Production had drifted from `packages/db/schema/` because schema changes were
applied via `drizzle-kit push` / direct SQL rather than the
`generate → commit → migrate` flow. These scripts diagnosed and patched that
drift. The full write-up is in `docs/audits/schema-audit-2026-05-11.md`.

**The drift these scripts patched is now codified in the migration history:**
- the `fix-schema-drift.sql` columns are in migrations `0006`–`0009`;
- the later out-of-band changes (vendor approval, ceremony types, soft-delete)
  are captured in `0026_drift_rollup.sql`.

Disaster-recovery replay is proven in `docs/launch/dr-replay-verification.md`.
**`fix-schema-drift.sql` is superseded** — never re-apply it; use the migration
chain instead.

## Inventory

| File | Type | Purpose |
|------|------|---------|
| `audit-all-schema.js` | read-only | Compared `schema/index.ts` columns vs prod `information_schema`; produced the original "missing columns" report. |
| `fix-schema-drift.sql` | **superseded** patch | Additive DDL applied to prod to close the gap. Now redundant (see above). |
| `apply-schema-fix.js` | runner | Executed `fix-schema-drift.sql` against prod via `pg` (used on Windows where `psql` was absent). |
| `diagnose-500s.js` | read-only | Reran the SELECTs that were 500-ing to confirm the missing-column root cause. |
| `diagnose-feed.js` | read-only | Cross-checked PG + MongoDB + Redis to diagnose the empty `/feed`. |
| `fix-feed.js` | diagnostic + repair | Predicted feed-filter pass/fail per test user; busted stale `match_feed:*` Redis cache. |
| `check-databases.js` | read-only | Listed MongoDB databases / collection counts. |
| `check-profiles.js` | read-only | Spot-checked the two demo-user `profiles_content` documents. |
| `fix-age-prefs.js` | one-off MongoDB patch | Set `partnerPreferences.ageRange` for two demo users. |
| `fix-all-prefs.js` | one-off MongoDB patch | Widened demo users' partner preferences (age/religion/distance). |
| `fix-caste-income.js` | one-off MongoDB patch | Set inter-caste + income-range prefs for demo users. |

## See also

- `docs/audits/schema-audit-2026-05-11.md` — the audit that catalogued the drift.
- `docs/launch/dr-replay-verification.md` — proof that migrations now reproduce prod.
- `docs/MIGRATIONS-PENDING.md` — the out-of-band prod SQL (vendor approval) now rolled into `0026`.
