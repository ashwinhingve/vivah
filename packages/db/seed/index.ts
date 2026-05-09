import { seedFullDemo } from './full-demo.js';

seedFullDemo()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); });
