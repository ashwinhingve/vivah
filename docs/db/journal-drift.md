# Drizzle migration-journal drift — 0030 / 0031 are untracked

> **Status:** KNOWN ISSUE, not yet remediated. Does **not** block Phase 5 Sprint A
> (all sprint tables already exist — migration `0028`). Fix this **before the next
> `drizzle-kit generate`**, as an operator-supervised task. Recorded 2026-07-17 by
> the Sprint A Phase 0 schema-freeze verification.

## The facts (verified)

Two committed migrations were applied as **raw hand-written SQL that bypassed
`drizzle-kit generate`**, so neither drizzle's file-side meta nor its DB-side
ledger knows about them:

| Migration (committed `.sql`) | Objects it creates | In `_journal.json`? | Snapshot `meta/00NN_snapshot.json`? | In DB ledger `drizzle.__drizzle_migrations`? | Objects present in DB? |
|---|---|---|---|---|---|
| `0030_pgvector_embedding_768.sql` | pgvector embedding → 768 dim | ❌ no | ❌ absent | ❌ no | ✅ yes |
| `0031_support_tickets.sql` | `support_tickets`, `ticket_messages`, `ticket_events` (+ enums) | ❌ no | ❌ absent | ❌ no | ✅ yes (`support_tickets`, `ticket_messages` confirmed) |

- `_journal.json` last entry: **idx 29 / `0029_pgvector_embedding`**.
- `meta/` snapshots: **`0000_snapshot.json` … `0029_snapshot.json`** (stop at 0029).
- `drizzle.__drizzle_migrations` (local docker DB): **30 rows** (0000–0029).
- Committed `.sql` files run **0000 → 0031** (+ `rollback-0030…`, `rollback-0031…`).
- Toolchain: `drizzle-kit ^0.29.1`, `drizzle-orm ^0.41.0`. Config
  `packages/db/drizzle.config.ts` (schema `./schema/index.ts`, out `./migrations`,
  default migrations table `drizzle.__drizzle_migrations`).

The schema source of truth `packages/db/schema/*.ts` **already reflects reality**
(`support.ts` tables + the 768-dim pgvector column are in the schema and exported
from `schema/index.ts`).

## Why it matters (the hazard)

`drizzle-kit generate` computes the next migration by **diffing current
`schema/*.ts` against the last snapshot (`0029_snapshot.json`)** and names the new
file by **journal length**. Because the journal/snapshots stop at 0029:

1. The next `generate` will **re-emit** the already-applied `support_tickets` +
   pgvector-768 objects (they're absent from the 0029 snapshot), and
2. it will number that file **`0030_*.sql`**, **colliding** with the existing
   hand-written `0030_pgvector_embedding_768.sql`.

So a naïve `pnpm --filter @smartshaadi/db db:generate` today produces a
**duplicate, mis-numbered migration**. Do not run it until this is reconciled.

## Invariants any fix MUST satisfy

- After the fix, `drizzle-kit generate` emits an **EMPTY** migration (zero drift).
- File meta (`_journal.json` + `meta/*_snapshot.json`) and the DB ledger
  (`drizzle.__drizzle_migrations`) are **internally consistent** and cover the same
  set of migrations.
- **Additive only.** No object is dropped, truncated, renamed, or has its PK
  altered. Never accept a drizzle `DROP` / `TRUNCATE` / `RENAME` / `ALTER COLUMN`
  prompt. The Better Auth tables (`user`, `session`, `account`, `verification`,
  `two_factor`) are **42P16-prone** — never let drizzle alter their PKs (see
  `CLAUDE.md`).

## Recommended remediation (operator-supervised, LOCAL-first)

The local docker DB (:5433) is disposable — **always dry-run there first**; only
touch prod after the local run satisfies the invariants above.

1. **Backup.** `meta/` is git-tracked, so the current commit *is* the backup — note
   the hash. Also snapshot the ledger:
   `docker exec -i smart-shaadi-postgres pg_dump -U vivah -d smart_shaadi -t 'drizzle.__drizzle_migrations' > /tmp/drizzle_ledger.sql` (or a `\copy`).
2. **Confirm schema is truth** — `schema/index.ts` already exports `support.ts` +
   the 768 pgvector column. No schema edit needed.
3. **Regenerate the reconciling migration** (Windows PowerShell preferred per
   `CLAUDE.md` for drizzle-kit; local URL is fine):
   `pnpm --filter @smartshaadi/db db:generate`
   → drizzle emits ONE migration capturing the 0029→now delta = exactly the
   already-applied `support_tickets` objects + the pgvector-768 change, plus a
   fresh snapshot + journal entry. **Inspect the emitted SQL** — it must contain
   ONLY those already-existing objects (all `CREATE TABLE IF NOT EXISTS` / additive
   `ALTER`), nothing destructive.
4. **Resolve the 0030 numbering collision** in the same PR. Cleanest option: this
   single generated file becomes the canonical drizzle record of the 0030/0031
   objects — **remove** the two hand-written raw files
   (`0030_pgvector_embedding_768.sql`, `0031_support_tickets.sql`) and their
   `rollback-*` counterparts, preserving their content in the PR description for
   provenance. (Alternative: keep them and manually renumber the generated file +
   its journal idx to `0032` — messier; only if history must be preserved verbatim.)
5. **Record as applied without re-running DDL** on each already-migrated DB (local,
   then prod). Because the objects already exist, either:
   - run `drizzle-kit migrate` (the `IF NOT EXISTS` creates no-op safely — verify
     the pgvector `ALTER` is idempotent first), **or**
   - insert a baseline marker row into `drizzle.__drizzle_migrations` (the
     migration hash + `created_at`) so drizzle marks it applied without executing.
6. **Verify the invariants.** Re-run `db:generate` → it must emit an **empty**
   migration. Confirm `_journal.json` last idx matches the file count and
   `drizzle.__drizzle_migrations` row count matches the journal length. Only then
   repeat steps 5–6 against prod (via the `CLAUDE.md` prod-migration protocol).

## What NOT to do

- **Do NOT hand-fabricate `0030_snapshot.json` / `0031_snapshot.json`.** They are
  large machine-generated files; a wrong snapshot silently corrupts drizzle's meta
  chain and every future diff — the exact destructive-meta hazard `CLAUDE.md`
  warns about. This is why Phase 0 documented the drift instead of editing meta.
- **Do NOT run `drizzle-kit push` against prod** — the Better Auth text-PK 42P16
  crash makes `push` unusable there (see `CLAUDE.md`).
