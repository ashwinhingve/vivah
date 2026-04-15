import { seedAuthUsers } from './auth.js';
import { seedProfileContent } from './profiles.js';
import { seedVendors } from './vendors.js';
import { seedBookings } from './bookings.js';

async function main() {
  console.info('🌱 Seeding database...');
  await seedAuthUsers();
  await seedProfileContent();
  await seedVendors();
  await seedBookings();
  console.info('✅ Seed complete');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
