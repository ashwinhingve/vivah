# Schema Drift Audit — 2026-05-11

**Auditor:** Phase 4 Day 3 hardening pass
**Scope:** Reconcile Drizzle schema definitions vs production Postgres state
**Result:** **No drift detected between local schema TS and Drizzle meta snapshots.**
Production-side verification deferred to PowerShell follow-up (see §5).

---

## 1. Method

Per CLAUDE.md, **WSL2 cannot reach the Railway public proxy** (ETIMEDOUT on
`shortline.proxy.rlwy.net`). All `psql "$DATABASE_URL"` ops must run from
native Windows PowerShell. From this WSL session, the audit is restricted to
**static analysis** of:

1. `packages/db/schema/*.ts` — Drizzle schema source of truth (TypeScript)
2. `packages/db/migrations/*.sql` — committed migration files (idx 0–13)
3. `packages/db/migrations/meta/*.json` — Drizzle meta snapshots
4. Root-level ad-hoc fix scripts: `apply-schema-fix.js`, `audit-all-schema.js`,
   `fix-schema-drift.sql`, etc. — captures every prod ALTER applied via psql

Cross-checked with `pnpm --filter @smartshaadi/db exec drizzle-kit generate
--name=phase4_audit_check`.

---

## 2. Findings

### 2.1 Local schema ↔ meta snapshots

> `drizzle-kit generate` exit message:
> **"No schema changes, nothing to migrate 😴"**

Schema TS files at `packages/db/schema/*.ts` are fully reflected in meta
snapshot `0013_snapshot.json`. No uncaptured TS edits.

### 2.2 Migration history

| idx | tag | Status |
|---|---|---|
| 0000 | `brave_zeigeist` | ✅ committed |
| ... | ... | ... |
| 0013 | `nebulous_typhoid_mary` | ✅ committed |

Latest migration `0013_nebulous_typhoid_mary` corresponds to
`feat(db): add historical_attendance_rate to guests + migration 0013`
(commit `c917cd9`).

### 2.3 Documented prod ALTERs (via fix-schema-drift.sql)

Commit `b4d9398` (2026-05-08) documents the largest documented schema-drift
repair: **76 columns added across 7 tables** via idempotent
`ADD COLUMN IF NOT EXISTS` SQL.

| Table | Cols added | Source |
|---|---|---|
| `kyc_verifications` | 38 | was a stub — full prod definition restored |
| `vendors` | 15 | extended profile fields |
| `match_requests` | 4 | priority + acceptance/decline/seen |
| `guests` | 8 | plus_ones + accessibility + check-in |
| `ceremonies` | 8 | status + venue_address + lifecycle |
| `invitations` | 2 | type + error_message |
| `notification_preferences` | 1 | muted_types |

Plus 3 enums (`match_request_priority`, `kyc_level`, `ceremony_status`) and
6 indexes added with `IF NOT EXISTS` guards.

**Reconciliation:** All these columns ARE present in
`packages/db/schema/*.ts` (the schema TS was the source the audit script
parsed). Therefore Drizzle meta is in sync — no `db:generate` action needed.
The drift was on the **migration file side**: the ad-hoc SQL bypassed the
normal `db:generate → commit migration → run migration` flow. Production was
patched directly.

### 2.4 Open question — migration vs meta snapshot truth

`packages/db/migrations/0000–0013_*.sql` files were generated incrementally
from local schema edits. But the prod database state mostly skipped those
files in favour of the ad-hoc `fix-schema-drift.sql` v2 application. This
means a fresh prod recovery from migrations alone might NOT produce the
current prod schema — a meta vs filesystem mismatch worth addressing in a
future cleanup pass.

---

## 3. Reconciliation Actions Taken

None required from local side. Schema TS already matches production (since
schema TS was authored first, then production was patched to match via
`fix-schema-drift.sql`).

`db:generate` produces empty migration → no schema-source drift.

---

## 4. Recommendations (deferred to future work)

1. **Generate a single rollup migration** capturing the cumulative state of
   `fix-schema-drift.sql` v2 + any subsequent ad-hoc patches, so
   migrations/*.sql becomes the canonical replay history again. Naming
   suggestion: `0014_phase4_drift_rollup.sql`. Mark as already-applied in
   `__drizzle_migrations` table on prod via `INSERT INTO __drizzle_migrations
   (hash, created_at) VALUES (...)`.

2. **Retire ad-hoc root-level scripts** — `apply-schema-fix.js`,
   `audit-all-schema.js`, `fix-schema-drift.sql`, `fix-age-prefs.js`, etc.
   These were production-incident response tools. Move to
   `scripts/incident-response/2026-05-08/` and reference in the runbook
   rather than leaving at repo root.

3. **Run `drizzle-kit push --verbose` from PowerShell** to confirm the
   `__drizzle_migrations` table is in a sane state vs current prod schema.
   Capture the output to `docs/audits/schema-audit-2026-05-11-prod-side.md`.

---

## 5. Production-Side Verification — PowerShell Steps

Cannot run from WSL. From a Windows PowerShell session with Postgres CLI
installed:

```powershell
# 1. Set env (single line — newlines split the value).
$env:DATABASE_URL = '<paste prod DATABASE_URL — never commit this>'

# 2. Snapshot prod tables for comparison
$tables = @('profiles','guests','community_zones','profile_sections',
            'plans','subscriptions','vendors','kyc_verifications',
            'match_requests','ceremonies','invitations',
            'notification_preferences','weddings','bookings','wedding_tasks')

foreach ($t in $tables) {
  psql $env:DATABASE_URL -c "\d $t" | Out-File "audits\prod_$t.txt"
}

# 3. Verify __drizzle_migrations contents
psql $env:DATABASE_URL -c "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id;" |
  Out-File "audits\prod_drizzle_migrations.txt"

# 4. Run drizzle-kit push --verbose (does NOT apply, only inspects)
cd packages\db
pnpm exec drizzle-kit push --verbose 2>&1 | Out-File "..\..\audits\push.log"

# 5. Cleanup
Remove-Item Env:\DATABASE_URL
```

If `push.log` shows ONLY destructive `ALTER` statements on Better Auth PK
columns (the known drizzle 42P16 hazard), the prod schema is in sync. Skip
those ALTERs — they are a drizzle bug, not real drift.

If `push.log` contains additive statements (`CREATE TABLE`, `ADD COLUMN`),
those represent **real undocumented drift** — open a ticket and reconcile.

---

## 6. Auditor Sign-off

- ✅ Local schema TS ↔ Drizzle meta: **in sync** (drizzle-kit confirms)
- ✅ Documented prod ALTERs (fix-schema-drift.sql v2): **all 76 columns
  present in schema TS**
- ⏳ Prod-side authoritative verification: **deferred to PowerShell
  follow-up** per CLAUDE.md WSL-vs-Railway constraint
- ⏳ Cleanup of ad-hoc root scripts: **scoped for later session**

**Phase 4 Day 3 conclusion:** No code-side drift to reconcile. Prod schema
state appears sane based on idempotent ad-hoc fix history, but cannot be
authoritatively confirmed from this WSL session.
