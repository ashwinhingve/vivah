/**
 * demoTraffic.test.ts — Verification suite for the demo-traffic dataset
 * (Sprint J Units 6.4/6.5).
 *
 * Tests the generator determinism, dataset invariants (no DB needed), and
 * DB signal checks (gracefully skipped if DB unreachable). Uses the same
 * tsx-run assertion style as calendar.test.ts.
 *
 * Run via: pnpm --filter @smartshaadi/db test
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Load .env
config({ path: resolve(__dirname, '../../../.env') });

const datasetPath = resolve(__dirname, 'data/demo-traffic-india.json');
const generatorScript = resolve(__dirname, 'data/build-demo-dataset.mjs');
const registryYearAnchor = '2026-07-18T00:00:00.000Z'; // Fixed anchor in build script

interface DemoDataset {
  meta: { counts: Record<string, number>; prngSeed: number; anchor: string };
  vendors: Array<{ id: string; category: string; city: string; email: string; userId: string; profileId: string; createdAt: string }>;
  services: Array<{ id: string; vendorId: string }>;
  capacities: Array<{ id: string; profileId: string; startAt: string; endAt: string }>;
  users: Array<{ id: string; profileId: string; email: string; phone: string; band: string; createdAt: string; lastActiveAt: string }>;
  matchRequests: Array<{ id: string; senderId: string; receiverId: string }>;
  bookings: Array<{ id: string; customerId: string; vendorId: string; eventDate: string }>;
  payments: Array<{ id: string; bookingId: string }>;
}

// Registry cities (must match CITIES array in build-demo-dataset.mjs)
const REGISTRY_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune',
  'Jaipur', 'Ahmedabad', 'Lucknow', 'Indore', 'Bhopal',
];

const fileHash = (path: string): string => {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
};

let passed = 0;
const test = (name: string, fn: () => void): void => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// ── Unit tests: assertNotProd ───────────────────────────────────────────────
test('assertNotProd: throws on NODE_ENV=production', () => {
  const { assertNotProd } = require('./demoTraffic.js');
  try {
    assertNotProd('postgresql://u:p@localhost:5433/db', 'production');
    assert.fail('should have thrown');
  } catch (e: unknown) {
    assert.ok(String(e).includes('NODE_ENV=production'));
  }
});

test('assertNotProd: throws on railway.proxy.rlwy.net', () => {
  const { assertNotProd } = require('./demoTraffic.js');
  try {
    assertNotProd('postgresql://u:p@shortline.proxy.rlwy.net:5432/railway', 'development');
    assert.fail('should have thrown');
  } catch (e: unknown) {
    assert.ok(String(e).includes('production'));
  }
});

test('assertNotProd: throws on "railway" in host', () => {
  const { assertNotProd } = require('./demoTraffic.js');
  try {
    assertNotProd('postgresql://u:p@railway-prod:5432/db', 'development');
    assert.fail('should have thrown');
  } catch (e: unknown) {
    assert.ok(String(e).includes('production'));
  }
});

test('assertNotProd: passes on localhost:5433', () => {
  const { assertNotProd } = require('./demoTraffic.js');
  assertNotProd('postgresql://u:p@localhost:5433/smart_shaadi', 'development');
});

// ── Generator determinism ────────────────────────────────────────────────────
test('generator: run twice produces identical JSON', () => {
  const hash1 = fileHash(datasetPath);

  const res = spawnSync('node', [generatorScript], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert.equal(res.status, 0, `Generator failed: ${res.stderr}`);

  const hash2 = fileHash(datasetPath);
  assert.equal(hash1, hash2, 'Dataset changed after re-running generator — determinism broken');
});

// ── Dataset invariants (no DB needed) ────────────────────────────────────────
const data = JSON.parse(readFileSync(datasetPath, 'utf-8')) as DemoDataset;

test('dataset: meta.counts match actual arrays', () => {
  const { counts } = data.meta;
  assert.equal(counts.vendors, data.vendors.length, `vendors: expected ${counts.vendors}, got ${data.vendors.length}`);
  assert.equal(counts.services, data.services.length, `services: expected ${counts.services}, got ${data.services.length}`);
  assert.equal(counts.capacities, data.capacities.length, `capacities: expected ${counts.capacities}, got ${data.capacities.length}`);
  assert.equal(counts.users, data.users.length, `users: expected ${counts.users}, got ${data.users.length}`);
  assert.equal(counts.matchRequests, data.matchRequests.length, `matchRequests: expected ${counts.matchRequests}, got ${data.matchRequests.length}`);
  assert.equal(counts.bookings, data.bookings.length, `bookings: expected ${counts.bookings}, got ${data.bookings.length}`);
  assert.equal(counts.payments, data.payments.length, `payments: expected ${counts.payments}, got ${data.payments.length}`);
});

test('dataset: every vendor city in registry', () => {
  const bad = data.vendors.filter((v) => !REGISTRY_CITIES.includes(v.city));
  assert.equal(bad.length, 0, `${bad.length} vendors have cities outside registry: ${bad.map((b) => b.city).join(', ')}`);
});

test('dataset: vendor emails unique', () => {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const v of data.vendors) {
    if (seen.has(v.email)) dups.push(v.email);
    seen.add(v.email);
  }
  assert.equal(dups.length, 0, `${dups.length} duplicate vendor emails: ${dups.slice(0, 5).join(', ')}`);
});

test('dataset: user phones unique', () => {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const u of data.users) {
    if (seen.has(u.phone)) dups.push(u.phone);
    seen.add(u.phone);
  }
  assert.equal(dups.length, 0, `${dups.length} duplicate user phones: ${dups.slice(0, 5).join(', ')}`);
});

test('dataset: every payment has a booking', () => {
  const bookingIds = new Set(data.bookings.map((b) => b.id));
  const bad = data.payments.filter((p) => !bookingIds.has(p.bookingId));
  assert.equal(bad.length, 0, `${bad.length} payments reference missing bookings: ${bad.slice(0, 3).map((b) => b.bookingId).join(', ')}`);
});

test('dataset: every capacity has a vendor profile', () => {
  const profileIds = new Set(data.vendors.map((v) => v.profileId));
  const bad = data.capacities.filter((c) => !profileIds.has(c.profileId));
  assert.equal(bad.length, 0, `${bad.length} capacities reference missing vendor profiles: ${bad.slice(0, 3).map((b) => b.profileId).join(', ')}`);
});

test('dataset: seasonality (Nov+Dec+Jan > May+Jun+Jul bookings)', () => {
  const monthBookings = new Map<string, number>();
  for (const b of data.bookings) {
    const month = b.eventDate.slice(0, 7);
    monthBookings.set(month, (monthBookings.get(month) ?? 0) + 1);
  }
  const peak = (monthBookings.get('2025-11') ?? 0) + (monthBookings.get('2025-12') ?? 0) + (monthBookings.get('2026-01') ?? 0);
  const off = (monthBookings.get('2026-05') ?? 0) + (monthBookings.get('2026-06') ?? 0) + (monthBookings.get('2026-07') ?? 0);
  assert.ok(peak > off, `Peak season (${peak}) should exceed off-season (${off}): Nov/Dec/Jan must dominate May/Jun/Jul`);
});

test('dataset: all four user bands populated', () => {
  const bands = new Set(data.users.map((u) => u.band));
  assert.equal(bands.has('active'), true, 'missing "active" band');
  assert.equal(bands.has('mid'), true, 'missing "mid" band');
  assert.equal(bands.has('inactive'), true, 'missing "inactive" band');
  assert.equal(bands.has('new'), true, 'missing "new" band');
  const bandCounts: Record<string, number> = {};
  for (const u of data.users) bandCounts[u.band] = (bandCounts[u.band] ?? 0) + 1;
  for (const [band, count] of Object.entries(bandCounts)) {
    assert.ok(count > 0, `band "${band}" has 0 users`);
  }
});

test('dataset: anchor matches generator constant', () => {
  assert.equal(data.meta.anchor, registryYearAnchor, `Dataset anchor ${data.meta.anchor} != generator anchor ${registryYearAnchor}`);
});

// ── DB signal checks (connect, skip gracefully if unreachable) ───────────────
(async () => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.log(`\ndemoTraffic: ${passed} tests passed`);
    console.log(`  ⊘ Database checks SKIPPED (DATABASE_URL not set)`);
    return;
  }

  let dbConnected = false;
  let dbError: string | null = null;

  try {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query('SELECT 1');
    await pool.end();
    dbConnected = true;
  } catch (e: unknown) {
    dbError = String(e);
  }

  if (!dbConnected || dbError) {
    console.log(`\ndemoTraffic: ${passed} tests passed`);
    console.log(`  ⊘ Database checks SKIPPED (unreachable): ${dbError}`);
    return;
  }

  // Run DB signal checks
  let dbPassed = 0;
  const dbTest = async (name: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
      dbPassed += 1;
      console.log(`  ✓ ${name}`);
    } catch (e: unknown) {
      console.error(`  ✗ ${name}: ${e}`);
      process.exit(1);
    }
  };

  await dbTest('database: 10 cities in registry', async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const res = await pool.query('SELECT COUNT(*)::int as cnt FROM cities');
      const count = Number(res.rows[0]?.cnt ?? 0);
      assert.equal(count, 10, `Expected 10 cities, got ${count}`);
    } finally {
      await pool.end();
    }
  });

  await dbTest('database: ≥150 demo vendors', async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const res = await pool.query('SELECT COUNT(*)::int as cnt FROM vendors WHERE id::text LIKE \'d2%\'');
      const count = Number(res.rows[0]?.cnt ?? 0);
      assert.ok(count >= 150, `Expected ≥150 demo vendors, got ${count}`);
    } finally {
      await pool.end();
    }
  });

  await dbTest('database: ≥200 demo bookings', async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const res = await pool.query('SELECT COUNT(*)::int as cnt FROM bookings WHERE customer_id LIKE \'demo-user-%\'');
      const count = Number(res.rows[0]?.cnt ?? 0);
      assert.ok(count >= 200, `Expected ≥200 demo bookings, got ${count}`);
    } finally {
      await pool.end();
    }
  });

  await dbTest('database: ≥40 demo users with marketing=true', async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const res = await pool.query(
        'SELECT COUNT(*)::int as cnt FROM notification_preferences np JOIN "user" u ON np.user_id = u.id WHERE u.id LIKE \'demo-user-%\' AND np.marketing = true'
      );
      const count = Number(res.rows[0]?.cnt ?? 0);
      assert.ok(count >= 40, `Expected ≥40 demo users with marketing=true, got ${count}`);
    } finally {
      await pool.end();
    }
  });

  await dbTest('database: seasonality confirmed (2025-11/12, 2026-01 > 2026-05/06/07)', async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      const res = await pool.query(`
        SELECT
          (SUM(CASE WHEN EXTRACT(YEAR FROM event_date) = 2025 AND EXTRACT(MONTH FROM event_date) IN (11, 12) THEN 1 ELSE 0 END)::int +
           SUM(CASE WHEN EXTRACT(YEAR FROM event_date) = 2026 AND EXTRACT(MONTH FROM event_date) = 1 THEN 1 ELSE 0 END)::int) as peak,
          SUM(CASE WHEN EXTRACT(YEAR FROM event_date) = 2026 AND EXTRACT(MONTH FROM event_date) IN (5, 6, 7) THEN 1 ELSE 0 END)::int as off_season
        FROM bookings
        WHERE customer_id LIKE 'demo-user-%'
      `);
      const row = res.rows[0] ?? { peak: 0, off_season: 0 };
      const peak = Number(row.peak ?? 0);
      const off_season = Number(row.off_season ?? 0);
      assert.ok(peak > off_season, `Peak (${peak}) should exceed off-season (${off_season})`);
    } finally {
      await pool.end();
    }
  });

  console.log(`\ndemoTraffic: ${passed} tests passed + ${dbPassed} DB checks passed`);
})();
