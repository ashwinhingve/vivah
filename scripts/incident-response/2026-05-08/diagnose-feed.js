/**
 * Diagnose why /feed is empty for the two test profiles.
 * Reads PG + MongoDB + Redis. Modifies nothing.
 *
 * Run from PowerShell with env vars set:
 *   $env:DATABASE_URL='postgres://...'
 *   $env:MONGODB_URI='mongodb+srv://...'
 *   $env:REDIS_URL='redis://...'
 *   node diagnose-feed.js
 */

const mongoose = require('mongoose');
const { Client } = require('pg');
const Redis = require('ioredis');

const USER_IDS = [
  'JgFFT6NVhB3V8giwzjiURocUdVFBpyP3',
  'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets',
];

function ageFromDob(dob) {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const mc = mongoose.connection.db.collection('profiles_content');

  const redis = new Redis(process.env.REDIS_URL, { family: 0, lazyConnect: true });
  await redis.connect();

  console.log('───────────────────────────────────────────────────────────');
  console.log('FEED DIAGNOSTIC — 2026-05-08');
  console.log('───────────────────────────────────────────────────────────\n');

  for (const uid of USER_IDS) {
    console.log(`━━━ userId: ${uid} ━━━`);

    // PG profile row (gender/dob/religion live in MongoDB, not PG)
    const pgRes = await pg.query(
      `SELECT id, verification_status, profile_completeness, is_active,
              latitude, longitude, last_active_at
       FROM profiles WHERE user_id = $1 LIMIT 1`,
      [uid],
    );
    if (pgRes.rows.length === 0) {
      console.log('  PG: profile NOT FOUND\n');
      continue;
    }
    const p = pgRes.rows[0];
    console.log('  PG:');
    console.log('    profileId           =', p.id);
    console.log('    verification_status =', p.verification_status,
      p.verification_status === 'VERIFIED' ? '✅' : '❌ blocks engine');
    console.log('    profile_completeness=', p.profile_completeness);
    console.log('    is_active           =', p.is_active, p.is_active ? '✅' : '❌');
    console.log('    coords              =', p.latitude, ',', p.longitude,
      p.latitude && p.longitude ? '✅' : '⚠️  no coords (distance filter falls back to city/state)');
    console.log('    last_active_at      =', p.last_active_at);

    // Mongo content
    const m = await mc.findOne({ userId: uid });
    console.log('  Mongo:');
    if (!m) {
      console.log('    NOT FOUND ❌\n');
    } else {
      const personal = m.personal ?? {};
      const location = m.location ?? {};
      const pref = m.partnerPreferences ?? {};
      console.log('    personal.fullName   =', personal.fullName);
      console.log('    personal.dob        =', personal.dob, `(age ${ageFromDob(personal.dob)})`);
      console.log('    personal.gender     =', personal.gender);
      console.log('    location.city/state =', location.city, '/', location.state);
      console.log('    pref.ageRange       =', JSON.stringify(pref.ageRange));
      console.log('    pref.religion       =', JSON.stringify(pref.religion));
      console.log('    pref.maxDistanceKm  =', pref.maxDistanceKm);
      console.log('    pref.openInterfaith =', pref.openToInterfaith);
      console.log('    pref.openInterCaste =', pref.openToInterCaste);
    }

    // Redis cache
    const key = `match_feed:${uid}`;
    const cached = await redis.get(key);
    const ttl = await redis.ttl(key);
    console.log('  Redis:');
    if (cached === null) {
      console.log(`    ${key} = MISS (next /feed will recompute) ✅`);
    } else {
      let parsed;
      try { parsed = JSON.parse(cached); } catch { parsed = cached; }
      const len = Array.isArray(parsed) ? parsed.length : 'n/a';
      console.log(`    ${key} = HIT (items=${len}, TTL=${ttl}s) ${len === 0 ? '❌ stale empty' : ''}`);
    }
    console.log('');
  }

  // Wide Redis scan for all match_feed:* keys
  console.log('━━━ All match_feed:* keys in Redis ━━━');
  let cursor = '0', allKeys = [];
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'match_feed:*', 'COUNT', 200);
    cursor = next;
    allKeys.push(...keys);
  } while (cursor !== '0');
  console.log(`  ${allKeys.length} key(s):`, allKeys);

  await pg.end();
  await mongoose.disconnect();
  await redis.quit();
  console.log('\n✅ done');
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
