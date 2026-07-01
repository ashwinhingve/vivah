/**
 * upload-qa-photos.ts — one-off data/asset fix.
 *
 * Uploads placeholder JPEGs to the R2 object keys that the QA seed already wrote
 * into Postgres `profile_photos` (`qa/photos/{userId}-{k}.jpg`). The DB keys are
 * correct; only the R2 objects were missing (seeded before R2 was live), so
 * presigned GETs 404 and photos don't render.
 *
 * This makes NO database or MongoDB writes. It only PUTs objects to the
 * QA-exclusive `qa/photos/` prefix in the media bucket. Idempotent: re-running
 * overwrites the same keys. Teardown is unaffected (it cascades from `profiles`
 * and never reads r2_key).
 *
 * Placeholder = DiceBear `initials` avatar (JPEG) seeded by the profile owner's
 * name — clearly a placeholder, not a real person. Falls back to picsum.
 *
 * Usage (from repo root):
 *   pnpm --filter @smartshaadi/api exec tsx scripts/upload-qa-photos.ts --dry-run
 *   pnpm --filter @smartshaadi/api exec tsx scripts/upload-qa-photos.ts        # live
 *
 * Env: reads apps/api/.env.production by default (DATABASE_URL + CLOUDFLARE_R2_*).
 * Override the env file with ENV_FILE=/path/to/file. R2_LIVE is irrelevant here —
 * this talks to R2 directly via S3Client, bypassing the app's mock gate.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';
import dotenv from 'dotenv';

const DRY_RUN = process.argv.includes('--dry-run');
const NO_DB = process.argv.includes('--no-db');

// Verified snapshot of the QA photo rows (from the prod/local `profile_photos`
// enumeration). Used with --no-db so the run needs only R2 creds — handy when
// the DB isn't reachable from the machine that CAN reach R2 (e.g. Windows).
// 17 INDIVIDUAL profiles × 2 photos = 34 keys under the qa/photos/ prefix.
const QA_PHOTO_OWNERS: ReadonlyArray<readonly [string, string]> = [
  ['qa-ind-01', 'Aditya Deshmukh'], ['qa-ind-02', 'Rohan Joshi'],
  ['qa-ind-03', 'Sneha Kulkarni'], ['qa-ind-04', 'Priyanka Patil'],
  ['qa-ind-05', 'Gurpreet Singh'], ['qa-ind-06', 'Simran Kaur'],
  ['qa-ind-07', 'Karthik Iyer'], ['qa-ind-08', 'Divya Subramanian'],
  ['qa-ind-09', 'Imran Sheikh'], ['qa-ind-10', 'Ayesha Khan'],
  ['qa-ind-11', 'Rahul Shah'], ['qa-ind-12', 'Khushboo Mehta'],
  ['qa-ind-13', 'Vikram Reddy'], ['qa-ind-14', 'Ananya Nair'],
  ['qa-ind-18', 'Thomas Mathew'], ['qa-ind-19', 'Neha Verma'],
  ['qa-ind-20', 'Sandeep Yadav'],
];

function staticRows(): Row[] {
  return QA_PHOTO_OWNERS.flatMap(([userId, name]) =>
    [1, 2].map((k) => ({
      r2_key: `qa/photos/${userId}-${k}.jpg`,
      is_primary: k === 1,
      name,
      user_id: userId,
    })),
  );
}
const here = fileURLToPath(new URL('.', import.meta.url));
const ENV_FILE = process.env.ENV_FILE ?? resolve(here, '../.env.production');

// Load env file WITHOUT clobbering anything already exported in the shell.
try {
  dotenv.config({ path: ENV_FILE });
  console.log(`env: loaded ${ENV_FILE}`);
} catch {
  console.log(`env: ${ENV_FILE} not loaded; relying on process.env`);
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const BUCKET = need('CLOUDFLARE_R2_BUCKET');
const ACCESS_KEY = need('CLOUDFLARE_R2_ACCESS_KEY');
const SECRET_KEY = need('CLOUDFLARE_R2_SECRET_KEY');
const ENDPOINT =
  process.env.CLOUDFLARE_R2_ENDPOINT ||
  `https://${need('CLOUDFLARE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

type Row = { r2_key: string; is_primary: boolean; name: string | null; user_id: string };

async function enumerateKeys(): Promise<Row[]> {
  const client = new pg.Client({ connectionString: need('DATABASE_URL') });
  await client.connect();
  try {
    const { rows } = await client.query<Row>(`
      SELECT pp.r2_key, pp.is_primary, u.name, u.id AS user_id
      FROM profile_photos pp
      JOIN profiles p ON p.id = pp.profile_id
      JOIN "user" u   ON u.id = p.user_id
      WHERE u.id LIKE 'qa-%'
      ORDER BY pp.r2_key
    `);
    return rows;
  } finally {
    await client.end();
  }
}

async function fetchPlaceholder(seed: string): Promise<Buffer> {
  const dice = `https://api.dicebear.com/9.x/initials/jpg?seed=${encodeURIComponent(seed)}&size=512`;
  try {
    const r = await fetch(dice);
    if (!r.ok) throw new Error(`dicebear ${r.status}`);
    const ct = r.headers.get('content-type') ?? '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (!ct.includes('jpeg') && !ct.includes('jpg')) throw new Error(`dicebear ct=${ct}`);
    return buf;
  } catch (e) {
    console.warn(`  dicebear failed (${String(e)}); falling back to picsum`);
    const pic = `https://picsum.photos/seed/${encodeURIComponent(seed)}/512/640.jpg`;
    const r = await fetch(pic);
    if (!r.ok) throw new Error(`picsum ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    // Only a genuine 404/NotFound means "missing". Network/TLS/auth errors must
    // surface — otherwise a broken connection masquerades as "all keys missing".
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

async function main() {
  console.log(`mode: ${DRY_RUN ? 'DRY-RUN (no uploads)' : 'LIVE upload'}${NO_DB ? ' [--no-db]' : ''}  bucket: ${BUCKET}  endpoint: ${ENDPOINT}`);
  const rows = NO_DB ? staticRows() : await enumerateKeys();
  console.log(`found ${rows.length} QA photo rows${NO_DB ? ' (static list)' : ''}`);
  if (rows.length === 0) {
    console.log('nothing to do');
    return;
  }
  const bad = rows.filter((r) => !r.r2_key.startsWith('qa/photos/'));
  if (bad.length) {
    throw new Error(
      `Refusing to run: ${bad.length} key(s) are outside the qa/photos/ prefix: ${bad
        .map((b) => b.r2_key)
        .join(', ')}`,
    );
  }

  let uploaded = 0;
  let existed = 0;
  for (const r of rows) {
    const seed = r.name?.trim() || r.user_id;
    const had = await objectExists(r.r2_key);
    if (had) existed++;
    const img = await fetchPlaceholder(seed);
    if (DRY_RUN) {
      console.log(`  [dry] ${r.r2_key}  seed="${seed}"  ${img.length}B  ${had ? '(exists)' : '(missing)'}`);
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: r.r2_key,
        Body: img,
        ContentType: 'image/jpeg',
      }),
    );
    uploaded++;
    console.log(`  put  ${r.r2_key}  seed="${seed}"  ${img.length}B  ${had ? '(overwrote)' : '(new)'}`);
  }

  console.log(
    DRY_RUN
      ? `dry-run complete: ${rows.length} keys would be uploaded (${existed} already exist)`
      : `done: ${uploaded} uploaded (${existed} pre-existing overwritten)`,
  );
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
