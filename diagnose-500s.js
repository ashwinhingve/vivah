/**
 * Reproduce the 500/400 errors directly against prod PG.
 * Read-only. Run from PowerShell with DATABASE_URL set.
 *
 *   $env:DATABASE_URL='...'
 *   node diagnose-500s.js
 */
const { Client } = require('pg');

const USER_IDS = [
  'JgFFT6NVhB3V8giwzjiURocUdVFBpyP3', // Riya
  'MyFBS3zkrMnmgh5meUK99VG9iFl90Ets', // Ashwin
];

(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  console.log('═══ DB schema reality check ═══\n');

  // What columns does prod have?
  for (const tbl of ['weddings', 'bookings', 'wedding_tasks', 'profiles']) {
    const cols = await pg.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name=$1 ORDER BY ordinal_position`,
      [tbl],
    );
    console.log(`-- ${tbl} (${cols.rows.length} cols) --`);
    cols.rows.forEach(r => console.log('  ', r.column_name, ':', r.data_type));
    console.log('');
  }

  console.log('═══ Reproduce listUserWeddings ═══\n');
  for (const uid of USER_IDS) {
    console.log(`userId: ${uid}`);
    try {
      const profile = await pg.query(`SELECT id FROM profiles WHERE user_id=$1 LIMIT 1`, [uid]);
      if (profile.rows.length === 0) { console.log('  no profile'); continue; }
      const pid = profile.rows[0].id;
      const wRes = await pg.query(
        `SELECT id, profile_id, partner_profile_id, mongo_wedding_plan_id, title,
                wedding_date, venue_name, venue_city, venue_address, budget_total,
                guest_count, bride_name, groom_name, hashtag, primary_color, status,
                created_at, updated_at
         FROM weddings WHERE profile_id=$1`,
        [pid],
      );
      console.log(`  weddings: ${wRes.rows.length} rows ✅`);
      for (const w of wRes.rows) {
        const tasks = await pg.query(`SELECT status FROM wedding_tasks WHERE wedding_id=$1`, [w.id]);
        console.log(`    wedding ${w.id} → ${tasks.rows.length} tasks`);
      }
    } catch (e) {
      console.log('  ❌ ERROR:', e.message);
      console.log('     SQLSTATE:', e.code, 'detail:', e.detail);
    }
    console.log('');
  }

  console.log('═══ Reproduce getBookings ═══\n');
  for (const uid of USER_IDS) {
    console.log(`userId: ${uid}`);
    try {
      const cnt = await pg.query(
        `SELECT count(*) FROM bookings WHERE customer_id=$1`,
        [uid],
      );
      console.log(`  bookings count: ${cnt.rows[0].count}`);
      const rows = await pg.query(
        `SELECT id, customer_id, vendor_id, service_id, wedding_id, ceremony_id,
                event_date, ceremony_type, status, total_amount, notes,
                package_name, package_price, guest_count, event_location,
                proposed_date, proposed_by, proposed_reason, proposed_at,
                created_at, updated_at
         FROM bookings WHERE customer_id=$1 ORDER BY event_date DESC LIMIT 10`,
        [uid],
      );
      console.log(`  rows: ${rows.rows.length} ✅`);
    } catch (e) {
      console.log('  ❌ ERROR:', e.message);
      console.log('     SQLSTATE:', e.code, 'detail:', e.detail);
    }
    console.log('');
  }

  console.log('═══ Reproduce match_requests received query ═══\n');
  for (const uid of USER_IDS) {
    console.log(`userId: ${uid}`);
    try {
      const profile = await pg.query(`SELECT id FROM profiles WHERE user_id=$1 LIMIT 1`, [uid]);
      if (profile.rows.length === 0) { console.log('  no profile'); continue; }
      const pid = profile.rows[0].id;
      const rows = await pg.query(
        `SELECT id, sender_id, receiver_id, status, created_at
         FROM match_requests WHERE receiver_id=$1 AND status='PENDING'
         ORDER BY created_at DESC LIMIT 20`,
        [pid],
      );
      console.log(`  pending received: ${rows.rows.length} ✅`);
    } catch (e) {
      console.log('  ❌ ERROR:', e.message);
      console.log('     SQLSTATE:', e.code, 'detail:', e.detail);
    }
    console.log('');
  }

  await pg.end();
  console.log('✅ done');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
