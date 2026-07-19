/**
 * Dev-only: run one marketing sweep pass (or just the attribution pass)
 * synchronously — the exact body the daily worker executes. Used by the
 * Sprint J E2E script; never part of the production process.
 *
 *   pnpm exec tsx src/dev/marketingSweepOnce.ts            # sweep + attribution
 *   pnpm exec tsx src/dev/marketingSweepOnce.ts attribute  # attribution only
 */
import { runDueCampaigns, attributeConversions } from '../marketing/service.js';

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'sweep';
  if (mode === 'attribute') {
    const n = await attributeConversions(new Date());
    console.log('attributed:', n);
  } else {
    const r = await runDueCampaigns(new Date());
    console.log('sweep:', JSON.stringify(r));
    const n = await attributeConversions(new Date());
    console.log('attributed:', n);
  }
  process.exit(0);
}

main().catch((e: unknown) => { console.error('failed:', e); process.exit(1); });
