/**
 * Fix /feed empty for two test profiles.
 *  1. Print personal.religion / maritalStatus / income for both (so we can spot
 *     filter rejects — religion mismatch is the most likely remaining blocker
 *     once cache is busted).
 *  2. DEL all match_feed:* keys so next /feed call recomputes from real Mongo.
 *  3. Print expected post-fix behavior.
 *
 * Run from PowerShell with the same env vars as diagnose-feed.js.
 */

const mongoose = require('mongoose');
const Redis = require('ioredis');

const USER_IDS = [
  'JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', // Riya, 19F
  'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets', // Ashwin, 20M
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const mc = mongoose.connection.db.collection('profiles_content');

  const redis = new Redis(process.env.REDIS_URL, { family: 0, lazyConnect: true });
  await redis.connect();

  console.log('━━━ Mongo personal/profession deep-check ━━━\n');
  const rows = {};
  for (const uid of USER_IDS) {
    const m = await mc.findOne({ userId: uid });
    if (!m) { console.log(uid, 'NOT FOUND'); continue; }
    const personal = m.personal ?? {};
    const profession = m.profession ?? {};
    const lifestyle = m.lifestyle ?? {};
    const horoscope = m.horoscope ?? {};
    rows[uid] = { personal, profession, lifestyle, horoscope };
    console.log(uid);
    console.log('  personal.religion        =', JSON.stringify(personal.religion));
    console.log('  personal.maritalStatus   =', JSON.stringify(personal.maritalStatus));
    console.log('  personal.fullName        =', personal.fullName);
    console.log('  personal.gender          =', personal.gender);
    console.log('  profession.incomeRange   =', JSON.stringify(profession.incomeRange));
    console.log('  lifestyle.diet           =', JSON.stringify(lifestyle.diet));
    console.log('  horoscope.manglik        =', JSON.stringify(horoscope.manglik));
    console.log('');
  }

  // Check religion compatibility
  const r0 = rows[USER_IDS[0]]?.personal?.religion ?? '';
  const r1 = rows[USER_IDS[1]]?.personal?.religion ?? '';
  console.log('━━━ Filter prediction ━━━');
  console.log(`  religion: "${r0}" vs "${r1}"`);
  if (!r0 || !r1) {
    console.log('  ⚠️  one or both religion fields EMPTY — filter compares strict equality');
    console.log('     openToInterfaith=false on both → strict equality required');
    console.log('     "" === "" passes IF both empty; mixed empty/value FAILS');
  } else if (r0 === r1) {
    console.log('  ✅ religion match');
  } else {
    console.log('  ❌ religion mismatch and openToInterfaith=false on both → FILTER REJECTS');
    console.log('     Fix: set openToInterfaith=true on at least one OR align religion values.');
  }

  // Bust caches
  console.log('\n━━━ Busting match_feed:* cache ━━━');
  let cursor = '0', allKeys = [];
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'match_feed:*', 'COUNT', 200);
    cursor = next;
    allKeys.push(...keys);
  } while (cursor !== '0');
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
    console.log(`  deleted ${allKeys.length} key(s):`, allKeys);
  } else {
    console.log('  no keys present');
  }

  console.log('\n━━━ Next steps ━━━');
  console.log('  1. Reload /feed in browser for both users.');
  console.log('  2. If religion check above said ✅ match, both should now see each other.');
  console.log('  3. If religion ❌ mismatch, edit one user`s religion in Mongo OR flip openToInterfaith=true.');

  await mongoose.disconnect();
  await redis.quit();
  console.log('\n✅ done');
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
