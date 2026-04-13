import { seedAuthUsers } from './auth.js';

async function main() {
  console.info('🌱 Seeding database...');
  await seedAuthUsers();
  console.info('✅ Seed complete');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
