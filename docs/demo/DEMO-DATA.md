# Smart Shaadi Demo Dataset

> **Last generated:** 2026-07-18 via `build-demo-dataset.mjs` (deterministic PRNG, fixed anchor)

---

## What Is It?

The demo dataset is **production-real** data that flows through the exact same tables, constraints, and validation logic as live traffic. There are **no special code paths** for demo data — every row is inserted via the standard loader and can be queried by real application code.

**Coverage:**
- **150 vendors** across the 10 registry cities (Mumbai, Delhi, Bangalore, Hyderabad, Pune, Jaipur, Ahmedabad, Lucknow, Indore, Bhopal)
- **50 users** engineered into four marketing segments
- **200 bookings** spanning Sep 2025 → Jul 2026, shaped by wedding-season weights (Nov–Feb peak)
- **171 payments** (advances for confirmed, full for completed, refunds for cancellations)
- **904 capacity windows** for vendor utilization forecasting
- **58 match requests** (last 7 days, high-intent signal)
- **300 vendor services** (2 per vendor)

All rows carry deterministic, namespaced UUIDs (`d<namespace>000000-0000-4000-8000-<seq>`) and IDs prefixed with `demo-*`, making them trivial to identify and remove.

---

## Regenerate & Load

### Step 1: Rebuild the Dataset

```bash
cd packages/db/seed/data
node build-demo-dataset.mjs
# → Overwrites demo-traffic-india.json (deterministic, byte-identical each run)
# → Verify: git diff packages/db/seed/data/demo-traffic-india.json (should be empty)
```

**Why deterministic?** The generator uses a fixed PRNG seed (`20260718`) and a fixed "now" anchor (`2026-07-18T00:00:00Z`). Running it twice produces identical output — no randomness, no drift, and the dataset is reviewable in PRs.

### Step 2: Load into the Database

```bash
pnpm --filter @smartshaadi/db db:seed:demo
# Checks: NODE_ENV != 'production' AND DATABASE_URL host ∉ {rlwy.net, railway, prod}
# Idempotent: fixed UUIDs + onConflictDoNothing — run-twice is safe
```

### Production Guard

The loader runs these checks before touching the DB:

```typescript
if (NODE_ENV === 'production') throw Error('... NODE_ENV=production');
if (!DATABASE_URL) throw Error('... DATABASE_URL not set');
if (/rlwy\.net|railway|prod/.test(DATABASE_URL)) throw Error('... host looks like production');
```

**Never commit the generated JSON or re-seed accidentally into production.** The guard is your safety net.

---

## Marketing Segments

The 50 demo users are engineered to populate every email/SMS campaign segment:

| Band | Idx | Activity | Count | Signal | Use Case |
|------|-----|----------|-------|--------|----------|
| **active** | 1–15 | Last 0–3 days | 15 | High intent | Recent matches + messages |
| **mid** | 16–30 | Last 4–12 days | 15 | Moderate | Engagement re-activation |
| **inactive** | 31–45 | Last 15–60 days | 15 | Win-back | Retention campaign |
| **new** | 46–50 | Last <48h, incomplete | 5 | Onboarding | Welcome email + SMS |

**Queries to inspect each segment:**

**Active (high-intent, last 3 days):**
```sql
SELECT COUNT(*) FROM profiles
WHERE "userId" LIKE 'demo-user-%'
  AND "lastActiveAt" > NOW() - INTERVAL '3 days';
```
Expected: ~15

**Mid (4–12 days ago):**
```sql
SELECT COUNT(*) FROM profiles
WHERE "userId" LIKE 'demo-user-%'
  AND "lastActiveAt" > NOW() - INTERVAL '12 days'
  AND "lastActiveAt" <= NOW() - INTERVAL '4 days';
```
Expected: ~15

**Inactive (15–60 days ago, win-back):**
```sql
SELECT COUNT(*) FROM profiles
WHERE "userId" LIKE 'demo-user-%'
  AND "lastActiveAt" > NOW() - INTERVAL '60 days'
  AND "lastActiveAt" <= NOW() - INTERVAL '15 days';
```
Expected: ~15

**New (< 48h, incomplete profile):**
```sql
SELECT COUNT(*) FROM profiles
WHERE "userId" LIKE 'demo-user-%'
  AND "createdAt" > NOW() - INTERVAL '2 days'
  AND "profileCompleteness" < 40;
```
Expected: ~5

---

## Revenue Signals

### Per-City Vendor Density

Intentionally **uneven** — each city has starved and saturated categories so gap-detection dashboards have real signal:

```sql
SELECT c.name, COUNT(v.id) as vendor_count, ARRAY_AGG(DISTINCT v.category) as categories
FROM vendors v
JOIN cities c ON v.city_id = c.id
WHERE v.id LIKE 'd2%'
GROUP BY c.id, c.name
ORDER BY vendor_count DESC;
```

Expected: ~15 vendors per city, uneven category mix per city

### Booking Seasonality (Forecast Signal)

Wedding season dominates (Nov → Feb muhurat period):

```sql
SELECT
  DATE_TRUNC('month', "eventDate")::date as month,
  COUNT(*) as bookings,
  SUM(CAST("totalAmount" AS numeric)) / 100000.0 as revenue_lakhs
FROM bookings
WHERE "customerId" LIKE 'demo-user-%'
GROUP BY DATE_TRUNC('month', "eventDate")
ORDER BY month;
```

Expected: Nov+Dec 2025 and Jan+Feb 2026 >> May+Jun+Jul 2026

### Vendor Utilization (Capacity Windows)

Vendor profiles carry capacity windows; utilization engine reads `bookedCount / maxBookings`:

```sql
SELECT
  v.businessName,
  COUNT(vc.id) as windows,
  SUM(vc."maxBookings") as max_capacity,
  SUM(vc."bookedCount") as booked,
  ROUND(100.0 * SUM(vc."bookedCount") / SUM(vc."maxBookings"), 1) as utilization_pct
FROM vendor_capacity vc
JOIN vendors v ON v."profileId" = vc."profileId"
WHERE v.id LIKE 'd2%'
GROUP BY v.id, v.businessName
ORDER BY utilization_pct DESC
LIMIT 10;
```

Expected: utilization ranges 0–100%, uneven across vendors (realistic market variance)

### Payment Status Distribution

Completed, confirmed (advance), cancelled (partial refunds), disputed:

```sql
SELECT
  b.status as booking_status,
  p.status as payment_status,
  COUNT(*) as count,
  ROUND(AVG(CAST(p.amount AS numeric)), 0) as avg_amount
FROM bookings b
LEFT JOIN payments p ON b.id = p."bookingId"
WHERE b."customerId" LIKE 'demo-user-%'
GROUP BY b.status, p.status
ORDER BY b.status, p.status;
```

Expected: mix of statuses reflecting real lifecycle (completed → captured, confirmed → partial, cancelled → refunded/null)

---

## Marketing Consent

~80% of demo users opted into marketing; the remainder exercise the **no marketing** path:

```sql
SELECT
  COUNT(DISTINCT np."userId") as users,
  COALESCE(np.marketing, false) as marketing_consent
FROM notification_preferences np
JOIN "user" u ON np."userId" = u.id
WHERE u.id LIKE 'demo-user-%'
GROUP BY np.marketing
ORDER BY marketing_consent DESC;
```

Expected: ~40 opted-in, ~10 opted-out

---

## ⚠ Aging Caveat

The dataset **anchors at 2026-07-18** — a fixed moment in time. Time-relative segments (e.g., "new in last 48h", "inactive 15–60 days") decay as real time passes:

```
Run time → Segment decay
2026-07-18   All segments fresh
2026-07-20   "new" band shrinks; "active" creeps toward "mid"
2026-08-01   Entire dataset appears 2 weeks older
```

**To refresh segmentation for a new anchor date:**

1. Edit `const NOW` in `packages/db/seed/data/build-demo-dataset.mjs` to today's date
2. Run `node build-demo-dataset.mjs` (regenerates JSON)
3. Optionally `git add` and commit the updated JSON (shows replay of changes)
4. Run `pnpm --filter @smartshaadi/db db:seed:demo` (reloads, idempotent)

---

## Remove Demo Data

To erase the dataset (e.g., before production cutover), run these SQL statements **in order** (respects FK constraints):

```sql
BEGIN;

-- Match requests (references user profiles)
DELETE FROM match_requests
WHERE "senderId" LIKE 'd7%' OR "receiverId" LIKE 'd7%';

-- Payments (references bookings)
DELETE FROM payments
WHERE "bookingId" LIKE 'd5%';

-- Bookings (references customers + vendors)
DELETE FROM bookings
WHERE "customerId" LIKE 'demo-user-%' OR "vendorId" LIKE 'd2%';

-- Vendor capacity windows (references vendor profiles)
DELETE FROM vendor_capacity
WHERE "profileId" LIKE 'd1%' AND EXISTS (
  SELECT 1 FROM vendors v WHERE v."profileId" = vendor_capacity."profileId" AND v.id LIKE 'd2%'
);

-- Vendor event types & services (references vendors)
DELETE FROM vendor_event_types
WHERE "vendorId" LIKE 'd2%';

DELETE FROM vendor_services
WHERE "vendorId" LIKE 'd2%';

-- Vendors (references users)
DELETE FROM vendors
WHERE id LIKE 'd2%';

-- Notification preferences (references users)
DELETE FROM notification_preferences
WHERE "userId" LIKE 'demo-user-%' OR "userId" LIKE 'demo-vendor-%';

-- Profiles (references users)
DELETE FROM profiles
WHERE id LIKE 'd1%' OR id LIKE 'd7%';

-- Users (Better Auth)
DELETE FROM "user"
WHERE id LIKE 'demo-user-%' OR id LIKE 'demo-vendor-%';

COMMIT;
```

**Safety checklist:**
- [ ] Backup the DB via Railway dashboard → Postgres → Backups → "Create backup now"
- [ ] Run in a transaction (wrap in `BEGIN; ... COMMIT;`)
- [ ] Check row counts after each statement
- [ ] Verify no app errors post-deletion (segments should be empty, forecasts should have no demo signal)

---

## Verification

Both test files verify the dataset:

```bash
pnpm --filter @smartshaadi/db test
```

**Test suite covers:**
- ✓ Generator determinism (runs twice, hashes must match)
- ✓ Dataset invariants (counts, cities, email/phone uniqueness, FK refs, seasonality, bands)
- ✓ DB signal checks (graceful skip if DB unreachable; verifies cities, vendor count, booking count, marketing pref count, seasonal weights)

---

## References

- **Generator:** `packages/db/seed/data/build-demo-dataset.mjs` — fixed PRNG (mulberry32 seed 20260718), deterministic output
- **Loader:** `packages/db/seed/demoTraffic.ts` — idempotent insert, prod guard, chunked to avoid memory spike
- **Test suite:** `packages/db/seed/demoTraffic.test.ts` — determinism + invariants + DB signal checks
- **Load command:** `pnpm --filter @smartshaadi/db db:seed:demo`
