/**
 * Snapshot staleness check (runs as this package's `lint` script, so CI's
 * turbo lint catches it). Rebuilds the snapshot in memory and diffs it against
 * the committed src/snapshots.generated.ts — fails when apps/web content
 * changed without regenerating.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSnapshotSource } from './generate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, '..', 'src', 'snapshots.generated.ts');

const expected = buildSnapshotSource();
let committed = '';
try {
  committed = readFileSync(SNAPSHOT_PATH, 'utf8');
} catch {
  console.error('❌ snapshots.generated.ts is missing. Run: pnpm --filter @smartshaadi/content generate');
  process.exit(1);
}

if (committed !== expected) {
  console.error(
    '❌ Content snapshot is STALE — apps/web content changed without regenerating.\n' +
    '   Fix: pnpm --filter @smartshaadi/content generate  (then commit the result)',
  );
  process.exit(1);
}

console.log('✅ content snapshot is up to date');
