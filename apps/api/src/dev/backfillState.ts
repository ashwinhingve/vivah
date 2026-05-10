/**
 * Backfill missing `location.state` on existing ProfileContent docs by looking
 * up the city in CITY_STATE_TABLE (apps/api/src/lib/geocode.ts).
 *
 * Run once after the form fix lands, against prod and any seeded dev DB:
 *   pnpm tsx apps/api/src/dev/backfillState.ts
 *
 * Mock mode: walks mockStore.json and patches in place.
 * Live mode:  walks ProfileContent docs in MongoDB.
 */

import { connectMongo } from '../lib/mongo.js';
import { ProfileContent } from '../infrastructure/mongo/models/ProfileContent.js';
import { getStateForCity } from '../lib/geocode.js';
import { env } from '../lib/env.js';
import { mockGet, mockUpsertField } from '../lib/mockStore.js';

interface LocationLike { city?: string; state?: string }
interface MockDoc { userId: string; location?: LocationLike }

async function backfillLive(): Promise<{ scanned: number; patched: number }> {
  await connectMongo();
  type LeanDoc = { userId: string; location?: LocationLike };
  const Model = ProfileContent as unknown as {
    find: (filter: object) => { lean: () => Promise<LeanDoc[]> };
    updateOne: (filter: object, update: object) => Promise<{ modifiedCount?: number }>;
  };
  const docs = await Model.find({ 'location.city': { $exists: true, $ne: '' } }).lean();
  let patched = 0;
  for (const doc of docs) {
    const city = doc.location?.city;
    const state = doc.location?.state;
    if (!city) continue;
    if (state && state.trim() !== '') continue;
    const derived = getStateForCity(city);
    if (!derived) continue;
    await Model.updateOne(
      { userId: doc.userId },
      { $set: { 'location.state': derived } },
    );
    patched += 1;
    console.info(`[backfillState] ${doc.userId} ${city} → ${derived}`);
  }
  return { scanned: docs.length, patched };
}

async function backfillMock(): Promise<{ scanned: number; patched: number }> {
  const fs = await import('fs');
  const path = await import('path');
  const storePath = path.resolve(process.cwd(), 'apps/api/.data/mockStore.json');
  if (!fs.existsSync(storePath)) {
    console.warn(`[backfillState] mock store not found: ${storePath}`);
    return { scanned: 0, patched: 0 };
  }
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as Record<string, MockDoc>;
  let scanned = 0;
  let patched = 0;
  for (const [userId, doc] of Object.entries(raw)) {
    scanned += 1;
    const city = doc.location?.city;
    const state = doc.location?.state;
    if (!city) continue;
    if (state && state.trim() !== '') continue;
    const derived = getStateForCity(city);
    if (!derived) continue;
    mockUpsertField(userId, 'location.state', derived);
    void mockGet; // keep imports referenced
    patched += 1;
    console.info(`[backfillState] ${userId} ${city} → ${derived}`);
  }
  return { scanned, patched };
}

async function main(): Promise<void> {
  const live = !env.USE_MOCK_SERVICES || env.MONGO_LIVE === true;
  console.info(`[backfillState] mode=${live ? 'LIVE' : 'MOCK'}`);
  const { scanned, patched } = live ? await backfillLive() : await backfillMock();
  console.info(`[backfillState] done — scanned=${scanned} patched=${patched}`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[backfillState] failed:', err);
  process.exit(1);
});
