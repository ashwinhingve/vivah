# Index Plan — analytics & reporting read paths

> Phase 8 Sprint H (Unit 8.3). Companion to `packages/db/migrations/0035_scale_indexes.sql`.

This documents *why* each index in migration 0035 exists, and — just as importantly —
which candidate indexes were deliberately **not** added. An index is not free: it costs
write throughput on every INSERT/UPDATE and consumes disk. Every index below was chosen
against a specific query in `apps/api/src/analytics/analytics.service.ts`, which is the
read path behind the Unit 8.3 PDF reports.

## Method

1. Read the four aggregation queries in `analytics.service.ts`.
2. Enumerate the pre-existing indexes on each table they touch.
3. Add an index only where the existing set genuinely fails the query's access pattern.
4. Confirm with `EXPLAIN` that the planner selects the new index **and** pushes both the
   equality and the range predicates into the `Index Cond`.

Step 4 matters: a composite index in the wrong column order still gets *selected*, but
only the leading predicate lands in `Index Cond` — the rest degrades to a heap recheck.
Seeing both predicates in the cond is what proves the column ordering is right.

Because the local database is empty, `EXPLAIN` was run with `SET enable_seqscan=off`.
That is enough to verify **shape** (does this index serve this query), but it is *not*
evidence about real-world plan choice on a populated table. Re-run the checks in
[Re-verifying on real data](#re-verifying-on-real-data) once production has traffic.

## Indexes added

### 1. `payments_status_created_idx` on `payments (status, created_at)`

Serves `getRevenueSeries()`:

```sql
WHERE created_at BETWEEN ? AND ?
  AND status IN ('CAPTURED','PARTIALLY_REFUNDED')
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
```

**This was the largest gap in the schema.** `payments` carried only
`payment_booking_idx (booking_id)` and `payment_status_idx (status)` — there was *no*
index on `created_at` at all. The platform-wide monthly revenue rollup, which every
platform report and the admin forecast dashboard depend on, sequentially scanned the
entire payments table.

Column order is `(status, created_at)`, not the reverse: `status` is an `IN` (equality)
predicate and `created_at` is a range. A btree can only use one range predicate, and only
after all leading equality predicates — so equality must come first. Reversed, the status
filter would not be usable as an index condition.

`payment_status_idx (status)` is now a strict prefix of this index and is therefore
redundant. It was left in place: dropping it is a non-additive change, out of scope for an
additive migration, and it is cheap. Flagged as cleanup — see
[Follow-ups](#follow-ups).

### 2. `bookings_vendor_date_status_idx` on `bookings (vendor_id, event_date, status)`

Serves `getVendorRevenueSeries()`:

```sql
WHERE vendor_id = ?
  AND event_date BETWEEN ? AND ?
  AND status IN ('CONFIRMED','COMPLETED')
```

`bookings` already had single-column indexes on `vendor_id`, `event_date`, and `status`
separately. Postgres would pick `booking_vendor_idx` and then recheck the date range and
status against the heap — fine for a vendor with ten bookings, bad for the busy vendors
who are exactly the ones pulling reports.

Ordering follows the same equality-then-range rule: `vendor_id` (equality) leads,
`event_date` (range) second. `status` sits third; because it follows a range column it
cannot be used as an index condition (visible in the `EXPLAIN` below — `status` is absent
from the `Index Cond`), but keeping it in the index still allows the status filter to be
resolved from the index tuple rather than the heap.

### 3. `vendor_capacity_profile_start_idx` on `vendor_capacity (profile_id, start_at)`

Serves `getUtilizationSeries()`:

```sql
WHERE profile_id = ?
  AND start_at BETWEEN ? AND ?
```

Neither existing index fits:

| Existing index | Why it fails this query |
|---|---|
| `vendor_capacity_profile_status_idx (profile_id, status, created_at)` | Leading column matches, but diverges immediately — `status` is not filtered here, so `start_at` is unreachable |
| `vendor_capacity_window_idx (start_at, end_at)` | No `profile_id` prefix, so it cannot narrow to one vendor first |

Note this query is keyed by `profiles.id`, not `vendors.id` — per CLAUDE.md rule 12 those
are different values. `vendor_capacity` is profile-keyed; `bookings` is vendor-keyed. The
report router resolves one to the other via an `innerJoin` on `profiles`.

## Verification

Run against the local database after applying 0035:

```sql
SET enable_seqscan=off;
EXPLAIN SELECT TO_CHAR(created_at,'YYYY-MM'), SUM(amount) FROM payments
 WHERE created_at BETWEEN '2025-07-01' AND '2026-07-01'
   AND status IN ('CAPTURED','PARTIALLY_REFUNDED') GROUP BY 1;
```

Observed — both predicates in the `Index Cond`, which is the result being checked for:

```
Index Scan using payments_status_created_idx on payments
  Index Cond: ((status = ANY ('{CAPTURED,PARTIALLY_REFUNDED}'::payment_status[]))
           AND (created_at >= '2025-07-01'::timestamp)
           AND (created_at <= '2026-07-01'::timestamp))
```

The other two behave the same way:

```
Index Scan using bookings_vendor_date_status_idx on bookings
  Index Cond: ((vendor_id = '...'::uuid)
           AND (event_date >= '2025-07-01'::date)
           AND (event_date <= '2026-07-01'::date))

Index Scan using vendor_capacity_profile_start_idx on vendor_capacity
  Index Cond: ((profile_id = '...'::uuid)
           AND (start_at >= '2025-07-01'::timestamp)
           AND (start_at <= '2026-07-01'::timestamp))
```

## Considered and rejected

| Candidate | Why not |
|---|---|
| `bookings (event_date, status)` | `getDemandSeries()` filters on `event_date` **only** — no status predicate. The existing `booking_date_idx (event_date)` already serves it exactly. Adding a composite would be write cost for no read gain. |
| `audit_logs (created_at)` | Already exists as `audit_created_idx` since migration 0000. |
| Covering / `INCLUDE` indexes for index-only scans | The aggregates (`SUM(amount)`, `SUM(total_amount)`) would need the value columns included, roughly doubling index size. Not justified until the row counts are real — revisit with the measurements below. |

## Re-verifying on real data

The empty-table caveat above means these choices are shape-verified, not
workload-verified. Once production carries real volume:

```sql
-- 1. Are the new indexes actually being chosen, and how often?
SELECT relname, indexrelname, idx_scan, idx_tup_read
  FROM pg_stat_user_indexes
 WHERE indexrelname IN ('payments_status_created_idx',
                        'bookings_vendor_date_status_idx',
                        'vendor_capacity_profile_start_idx');

-- 2. Any index nobody uses is pure write overhead — drop candidates.
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
 WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Re-run the EXPLAINs above WITHOUT enable_seqscan=off and confirm the
--    planner still prefers the index on real cardinality.
```

If `idx_scan` stays at 0 for any of the three after a month of real traffic, that index
was a mistake — drop it with `rollback-0035_scale_indexes.sql`.

## Operational notes

- 0035 uses plain `CREATE INDEX`, which takes an `ACCESS EXCLUSIVE`-adjacent lock blocking
  writes for the duration of the build. That is safe now because the tables are
  effectively empty pre-launch. **Once these tables are large, any future index migration
  must use `CREATE INDEX CONCURRENTLY`** — which cannot run inside a transaction block, so
  it must be applied by hand via the Railway SQL console rather than through drizzle-kit.
- All statements are `IF NOT EXISTS` and the migration is safe to re-run.
- `rollback-0035_scale_indexes.sql` drops only these three indexes. Index drops never touch
  row data, so rollback is non-destructive — the only consequence is slower reports.
- Per CLAUDE.md, `drizzle-kit push` is unusable against the production database (the 42P16
  Better Auth PK hazard). Apply 0035 to production through the Railway Data → Query console.

## Related

- `docs/handover/SCALING-PLAYBOOK.md` — capacity model and when to revisit indexing
- `docs/adr/ADR-001-pricing-model.md` — pricing model that `pricing_rules` serves
- `CLAUDE.md` → "Production DB Migration Protocol"
