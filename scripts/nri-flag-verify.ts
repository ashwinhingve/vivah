/**
 * nri-flag-verify.ts — proves NRI_MATCHING_LIVE actually does something, and
 * proves it does nothing to domestic pairs.
 *
 * WHY THIS EXISTS
 *
 * Unit 7.2 shipped with the flag OFF and was never exercised against data. Every
 * seeded profile took the column defaults (`country_of_residence = 'IN'`,
 * `open_to_nri_matching = false`), so isCrossBorder() and hasOptedIntoNri() both
 * returned false and the bypass at matchmaking/filters.ts:250 was unreachable —
 * flipping the flag changed nothing observable. Unit tests covered the branch
 * with hand-built objects, but nothing ever ran it against a database.
 *
 * This script runs the REAL production feed path (computeAndCacheFeed — the same
 * function the API route calls, including Redis caching) against REAL rows, once
 * per flag state, and diffs the two feeds.
 *
 * It must be run as two separate processes, because env.ts binds
 * NRI_MATCHING_LIVE at import time — mutating process.env after import would
 * test nothing. Hence the --expect argument rather than an internal loop.
 *
 *   NRI_MATCHING_LIVE=false tsx scripts/nri-flag-verify.ts --expect=off
 *   NRI_MATCHING_LIVE=true  tsx scripts/nri-flag-verify.ts --expect=on
 *
 * Exit 0 = the observed feed matched the matrix below. Exit 1 = it did not.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

config({ path: resolve(__dirname, '../apps/api/.env') });

const PRIYA_USER_ID = 'seed-individual-001';
const OUT_DIR = resolve(__dirname, '../.data/nri-verify');

/**
 * What each seeded candidate proves. `on` is whether the candidate should be in
 * Priya's feed with the flag ON; `off` likewise with it OFF.
 *
 * Priya: New Delhi, country IN, opted in, no mustHave.distance.
 */
const NRI_MATRIX: Array<{
  name: string; country: string; optedIn: boolean;
  off: boolean; on: boolean; proves: string;
}> = [
  { name: 'Aryan Khanna',  country: 'US', optedIn: true,  off: false, on: true,
    proves: 'cross-border + both opted in → bypass fires' },
  { name: 'Dhruv Sethi',   country: 'GB', optedIn: true,  off: false, on: true,
    proves: 'bypass is not US-specific' },
  { name: 'Manav Chadha',  country: 'CA', optedIn: true,  off: false, on: true,
    proves: 'bypass works for a third country' },
  { name: 'Imran Qureshi', country: 'AE', optedIn: false, off: false, on: false,
    proves: 'ONE-SIDED opt-in must never match, flag on or off' },
  { name: 'Harsh Vardhan', country: 'IN', optedIn: true,  off: false, on: false,
    proves: 'SAME-country pair still gets the ordinary distance check '
          + '(Bengaluru vs Delhi) — the safety property at filters.ts:247-249' },
];

async function main(): Promise<void> {
  const expectArg = process.argv.find((a) => a.startsWith('--expect='));
  const expect = expectArg?.split('=')[1];
  if (expect !== 'on' && expect !== 'off') {
    throw new Error('usage: nri-flag-verify.ts --expect=on|off');
  }

  // Import AFTER dotenv so env.ts sees the flag we were launched with.
  const { env } = await import('../apps/api/src/lib/env.js');
  const flagActual = env.NRI_MATCHING_LIVE;
  const flagExpected = expect === 'on';

  // Guard against the whole point of the script being silently defeated: if the
  // process did not actually come up in the state we asked for, every downstream
  // assertion is meaningless.
  if (flagActual !== flagExpected) {
    console.error(
      `FAIL: launched with --expect=${expect} but env.NRI_MATCHING_LIVE=${flagActual}. `
      + 'The flag did not take effect — check how the process was invoked.',
    );
    process.exit(1);
  }
  console.info(`NRI_MATCHING_LIVE = ${flagActual} (confirmed from env, not assumed)`);

  const { db } = await import('../apps/api/src/lib/db.js');
  const { redis } = await import('../apps/api/src/lib/redis.js');
  const { computeAndCacheFeed } = await import('../apps/api/src/matchmaking/engine.js');

  // This dev box runs USE_MOCK_SERVICES=true WITH MONGO_LIVE=true, so
  // shouldUseMockMongo is false and the engine issues real Mongoose queries.
  // The API server calls connectMongo() at boot; a standalone script has no such
  // boot, and an unconnected Mongoose call buffers for 10s and then throws
  // (CLAUDE.md rule 11). Connect explicitly rather than forcing mock mode — the
  // whole point is to exercise the same path the server takes.
  const { connectMongo } = await import('../apps/api/src/lib/mongo.js');
  await connectMongo();

  // Bust the feed cache first — a stale entry from the other flag state would
  // make this script report the previous run's answer.
  await redis.del(`match_feed:${PRIYA_USER_ID}`);

  const feed = await computeAndCacheFeed(PRIYA_USER_ID, db, redis);
  const names = feed.map((f: { name?: string }) => f.name ?? '(unnamed)').sort();

  console.info(`\nPriya's feed (${feed.length} profiles):`);
  for (const n of names) console.info(`  - ${n}`);

  // ── Assert the matrix ──────────────────────────────────────────────────────
  const inFeed = new Set(names);
  let failures = 0;
  console.info('\nMatrix:');
  for (const row of NRI_MATRIX) {
    const want = expect === 'on' ? row.on : row.off;
    const got = inFeed.has(row.name);
    const ok = want === got;
    if (!ok) failures++;
    console.info(
      `  ${ok ? 'PASS' : 'FAIL'}  ${row.name.padEnd(15)} ${row.country}  `
      + `expected=${want ? 'in feed' : 'absent'} actual=${got ? 'in feed' : 'absent'}`,
    );
    if (!ok) console.info(`        ↳ proves: ${row.proves}`);
  }

  // ── Domestic regression: the feed minus the NRI cohort must be identical ───
  //
  // This is the claim filters.ts:247-249 makes in a comment. Snapshot it on the
  // OFF run, compare on the ON run. Anything that moves here is a regression
  // affecting users who have nothing to do with this feature.
  const nriNames = new Set(NRI_MATRIX.map((r) => r.name));
  const domestic = names.filter((n) => !nriNames.has(n));
  mkdirSync(OUT_DIR, { recursive: true });
  const snapPath = resolve(OUT_DIR, 'domestic-feed.json');

  if (expect === 'off') {
    writeFileSync(snapPath, JSON.stringify(domestic, null, 2));
    console.info(`\nDomestic baseline written (${domestic.length} profiles) → ${snapPath}`);
  } else {
    if (!existsSync(snapPath)) {
      console.error('\nFAIL: no domestic baseline. Run --expect=off first.');
      process.exit(1);
    }
    const baseline = JSON.parse(readFileSync(snapPath, 'utf8')) as string[];
    const same = JSON.stringify(baseline) === JSON.stringify(domestic);
    console.info(`\nDomestic regression check: ${same ? 'PASS' : 'FAIL'} `
      + `(${baseline.length} baseline vs ${domestic.length} now)`);
    if (!same) {
      failures++;
      console.info(`  baseline: ${JSON.stringify(baseline)}`);
      console.info(`  now:      ${JSON.stringify(domestic)}`);
    }
  }

  await redis.quit();
  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.info('\nAll assertions passed.');
  process.exit(0);
}

main().catch((e: unknown) => { console.error('nri-flag-verify failed:', e); process.exit(1); });
