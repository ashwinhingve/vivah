/**
 * Demo data seed script — Smart Shaadi
 *
 * Creates 3 rich demo profiles via the live API (Aarav Sharma, Priya Joshi,
 * Anjali Mehta). Idempotent — re-running converges on the same end-state
 * without duplicates.
 *
 * Usage:
 *   pnpm seed:demo
 *   ALLOW_PROD_SEED=true pnpm seed:demo                 # skip confirm prompt
 *   API_URL=https://api.smartshaadi.co.in pnpm seed:demo
 *   SEED_OTP=135246 pnpm seed:demo
 *
 * Source data: docs/demo/demo-data-plan.md
 */

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { io as socketIoClient, type Socket } from 'socket.io-client';

import {
  PROFILES,
  AARAV,
  PRIYA,
  ANJALI,
  WEDDING_GUESTS,
  CHAT_SCRIPT,
  type DemoProfile,
} from './seed-demo-data.config.js';

const API_URL = (process.env['API_URL'] ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);
const SEED_OTP = process.env['SEED_OTP'] ?? '135246';
const ALLOW_PROD_SEED = process.env['ALLOW_PROD_SEED'] === 'true';
const SKIP_CHAT = process.env['SKIP_CHAT'] === 'true';
const SKIP_AI = process.env['SKIP_AI'] === 'true';

interface SessionData {
  profile: DemoProfile;
  cookie: string; // raw better-auth.session_token value
  userId?: string;
  profileId?: string;
}

const failures: { step: string; error: string }[] = [];
const successes: string[] = [];

function log(level: 'info' | 'warn' | 'err' | 'ok', msg: string): void {
  const tag =
    level === 'ok'
      ? '\x1b[32m[OK]\x1b[0m '
      : level === 'warn'
        ? '\x1b[33m[WARN]\x1b[0m '
        : level === 'err'
          ? '\x1b[31m[ERR]\x1b[0m '
          : '\x1b[36m[..]\x1b[0m ';
  console.log(`${tag}${msg}`);
}

async function confirmIfProd(): Promise<void> {
  if (ALLOW_PROD_SEED) return;
  const looksProd = /smartshaadi\.co\.in|prod|railway/i.test(API_URL);
  if (!looksProd) return;
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = await rl.question(
    `\nSEEDING ${API_URL} — proceed? Type "yes" to confirm: `,
  );
  rl.close();
  if (ans.trim().toLowerCase() !== 'yes') {
    log('err', 'aborted by user');
    process.exit(2);
  }
}

interface ApiOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  cookie?: string;
  expectStatus?: number[];
}

async function api<T = unknown>(
  path: string,
  opts: ApiOpts = {},
): Promise<{ status: number; data: T; rawCookie: string | null }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (opts.cookie) headers['cookie'] = `better-auth.session_token=${opts.cookie}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const setCookie = res.headers.get('set-cookie');
  const cookieMatch = setCookie?.match(/better-auth\.session_token=([^;]+)/);
  const rawCookie = cookieMatch?.[1] ?? null;

  let data: unknown;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  const okStatuses = opts.expectStatus ?? [200, 201];
  if (!okStatuses.includes(res.status)) {
    throw new Error(
      `${opts.method ?? 'GET'} ${path} → ${res.status}: ${
        typeof data === 'string' ? data : JSON.stringify(data)
      }`,
    );
  }

  return { status: res.status, data: data as T, rawCookie };
}

async function loginViaOtp(profile: DemoProfile): Promise<SessionData> {
  log('info', `auth: send OTP to ${profile.phone}`);
  await api(`/api/auth/phone-number/send-otp`, {
    method: 'POST',
    body: { phoneNumber: profile.phone },
    expectStatus: [200],
  });

  log('info', `auth: verify OTP for ${profile.phone}`);
  const verifyRes = await api<{ user?: { id: string } }>(
    `/api/auth/phone-number/verify-otp`,
    {
      method: 'POST',
      body: { phoneNumber: profile.phone, code: SEED_OTP },
      expectStatus: [200],
    },
  );

  if (!verifyRes.rawCookie) {
    throw new Error(
      `OTP verify returned no session cookie (status ${verifyRes.status})`,
    );
  }

  return {
    profile,
    cookie: verifyRes.rawCookie,
    userId: verifyRes.data?.user?.id,
  };
}

async function fillProfile(s: SessionData): Promise<void> {
  const p = s.profile;

  // Personal — content/personal
  await api('/api/v1/profiles/me/content/personal', {
    method: 'PUT',
    cookie: s.cookie,
    body: {
      fullName: p.personal.fullName,
      dob: p.personal.dob,
      gender: p.personal.gender,
      height: p.personal.height,
      maritalStatus: p.personal.maritalStatus,
      motherTongue: p.personal.motherTongue,
      religion: p.personal.religion,
      caste: p.personal.caste,
      subCaste: p.personal.subCaste,
      manglik: p.personal.manglik,
    },
  });

  await api('/api/v1/profiles/me/content/education', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.education,
  });

  await api('/api/v1/profiles/me/content/profession', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.profession,
  });

  await api('/api/v1/profiles/me/content/family', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.family,
  });

  await api('/api/v1/profiles/me/content/lifestyle', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.lifestyle,
  });

  await api('/api/v1/profiles/me/horoscope', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.horoscope,
  });

  await api('/api/v1/profiles/me/preferences', {
    method: 'PUT',
    cookie: s.cookie,
    body: p.preferences,
  });

  // Personality (POST, full body required)
  await api('/api/v1/profiles/me/personality', {
    method: 'POST',
    cookie: s.cookie,
    body: p.personality,
  });

  // Profile-level fields (stayQuotient, familyInclinationScore)
  await api('/api/v1/profiles/me', {
    method: 'PUT',
    cookie: s.cookie,
    body: {
      stayQuotient: p.stayQuotient,
      familyInclinationScore: p.familyInclinationScore,
    },
  });

  // Capture profileId for later steps
  const me = await api<{
    success: boolean;
    data?: { id?: string; profile?: { id?: string } };
  }>('/api/v1/profiles/me', { cookie: s.cookie });
  const data = me.data?.data ?? {};
  s.profileId = data.id ?? data.profile?.id;
  if (!s.profileId) {
    throw new Error('Could not resolve profileId from /profiles/me response');
  }
}

async function uploadPhotos(s: SessionData): Promise<void> {
  const existing = await api<{ data?: unknown[] }>(
    '/api/v1/profiles/me/photos',
    { cookie: s.cookie },
  );
  const count = Array.isArray(existing.data?.data) ? existing.data?.data?.length ?? 0 : 0;
  if (count >= s.profile.photoSeeds.length) {
    log('info', `photos: ${s.profile.key} already has ${count} photos, skipping uploads`);
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'seed-photos-'));

  for (let i = 0; i < s.profile.photoSeeds.length; i++) {
    const seed = s.profile.photoSeeds[i];
    const url = `https://picsum.photos/seed/${seed}/800/1000`;
    const localPath = join(tmp, `${seed}.jpg`);

    const imgRes = await fetch(url, { redirect: 'follow' });
    if (!imgRes.ok) {
      log('warn', `photo download failed: ${url} → ${imgRes.status}, skip`);
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    writeFileSync(localPath, buf);

    // 1. Get presigned URL
    const presign = await api<{
      data: { uploadUrl: string; r2Key: string };
    }>('/api/v1/storage/upload-url', {
      method: 'POST',
      cookie: s.cookie,
      body: {
        fileName: `${seed}.jpg`,
        mimeType: 'image/jpeg',
        folder: 'photos',
      },
    });
    const { uploadUrl, r2Key } = presign.data.data;

    // 2. PUT binary to R2
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: readFileSync(localPath),
    });
    if (!putRes.ok) {
      log('warn', `R2 PUT failed for ${seed}: ${putRes.status}, skip register`);
      continue;
    }

    // 3. Register photo
    await api('/api/v1/profiles/me/photos', {
      method: 'POST',
      cookie: s.cookie,
      body: {
        r2Key,
        fileSize: buf.byteLength,
        mimeType: 'image/jpeg',
        isPrimary: i === 0,
        displayOrder: i,
      },
    });
    log('ok', `photo ${i + 1}/${s.profile.photoSeeds.length} uploaded for ${s.profile.key}`);
  }
}

async function seedProfile(profile: DemoProfile): Promise<SessionData | null> {
  const stepRoot = `seed:${profile.key}`;
  try {
    const s = await loginViaOtp(profile);
    await fillProfile(s);
    await uploadPhotos(s);
    successes.push(`${stepRoot} → profileId=${s.profileId}`);
    log('ok', `profile complete: ${profile.personal.fullName} (${s.profileId})`);
    return s;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failures.push({ step: stepRoot, error: msg });
    log('err', `${stepRoot}: ${msg}`);
    return null;
  }
}

interface MatchRequestRow {
  id: string;
  receiverId: string;
  senderId: string;
  status: string;
}

async function sendInterestAndAccept(
  sender: SessionData,
  receiver: SessionData,
): Promise<string | null> {
  if (!receiver.profileId) {
    log('err', 'receiver profileId missing — cannot send interest');
    return null;
  }

  // Idempotency — list sent first
  const sent = await api<{ data?: MatchRequestRow[] }>(
    '/api/v1/matchmaking/requests/sent',
    { cookie: sender.cookie, expectStatus: [200, 404] },
  ).catch(() => null);
  const existing = (sent?.data?.data ?? []).find(
    (r) => r.receiverId === receiver.profileId,
  );

  let requestId: string;
  if (existing) {
    log('info', `interest already exists (${existing.status}) → ${existing.id}`);
    requestId = existing.id;
  } else {
    const created = await api<{ data: { id: string } }>(
      '/api/v1/matchmaking/requests',
      {
        method: 'POST',
        cookie: sender.cookie,
        body: {
          receiverId: receiver.profileId,
          message: `Hi! Looks like we share a lot in common — would love to chat.`,
        },
      },
    );
    requestId = created.data.data.id;
    log('ok', `interest sent ${sender.profile.key} → ${receiver.profile.key}`);
  }

  // Accept (idempotent — server should 4xx if already accepted)
  try {
    await api(`/api/v1/matchmaking/requests/${requestId}/accept`, {
      method: 'PUT',
      cookie: receiver.cookie,
      body: { welcomeMessage: 'Thanks for reaching out! Glad to chat.' },
      expectStatus: [200],
    });
    log('ok', `interest accepted by ${receiver.profile.key}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already|state|conflict|400|409/i.test(msg)) {
      log('info', `interest already in accepted/non-pending state, ok`);
    } else {
      throw e;
    }
  }

  return requestId;
}

async function seedChat(
  matchId: string,
  aaravSession: SessionData,
  priyaSession: SessionData,
): Promise<void> {
  if (SKIP_CHAT) {
    log('info', 'SKIP_CHAT=true — chat seeding skipped');
    return;
  }

  const sessions: Record<'aarav' | 'priya', SessionData> = {
    aarav: aaravSession,
    priya: priyaSession,
  };
  const sockets: Partial<Record<'aarav' | 'priya', Socket>> = {};

  function connect(key: 'aarav' | 'priya'): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const sock = socketIoClient(`${API_URL}/chat`, {
        auth: { token: sessions[key].cookie },
        transports: ['websocket'],
        reconnection: false,
        timeout: 8000,
      });
      sock.once('connect', () => resolve(sock));
      sock.once('connect_error', (err) =>
        reject(new Error(`socket connect failed for ${key}: ${err.message}`)),
      );
      setTimeout(() => reject(new Error(`socket timeout for ${key}`)), 10000);
    });
  }

  try {
    sockets.aarav = await connect('aarav');
    sockets.priya = await connect('priya');

    sockets.aarav!.emit('join_room', { matchRequestId: matchId });
    sockets.priya!.emit('join_room', { matchRequestId: matchId });
    await new Promise((r) => setTimeout(r, 500));

    for (const msg of CHAT_SCRIPT) {
      const sock = sockets[msg.from]!;
      sock.emit('send_message', {
        matchRequestId: matchId,
        content: msg.content,
        type: 'TEXT',
      });
      await new Promise((r) => setTimeout(r, 600));
      log('ok', `chat msg sent (${msg.from}): "${msg.content.slice(0, 40)}…"`);
    }
  } finally {
    sockets.aarav?.disconnect();
    sockets.priya?.disconnect();
  }
}

async function seedWedding(s: SessionData): Promise<string | null> {
  const list = await api<{ data: { weddings: { id: string }[] } }>(
    '/api/v1/weddings',
    { cookie: s.cookie },
  );
  const existing = list.data?.data?.weddings?.[0];
  let weddingId: string;
  if (existing) {
    log('info', `wedding already exists: ${existing.id}`);
    weddingId = existing.id;
  } else {
    const created = await api<{ data: { wedding: { id: string } } }>(
      '/api/v1/weddings',
      {
        method: 'POST',
        cookie: s.cookie,
        body: {
          weddingDate: '2026-12-15',
          venueName: 'Grand Sheraton Pune',
          venueCity: 'Pune',
          venueAddress: 'RBM Road, Pune, MH',
          title: 'Aarav & Priya — Dec 2026',
        },
      },
    );
    weddingId = created.data.data.wedding.id;
    log('ok', `wedding created ${weddingId}`);
  }

  // Add guests — best-effort idempotency by name
  for (const g of WEDDING_GUESTS) {
    try {
      await api(`/api/v1/weddings/${weddingId}/guests`, {
        method: 'POST',
        cookie: s.cookie,
        body: g,
      });
      log('ok', `guest added: ${g.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/duplicate|exists|conflict|409/i.test(msg)) {
        log('info', `guest ${g.name} already present, skip`);
      } else {
        log('warn', `guest ${g.name} failed: ${msg}`);
      }
    }
  }

  return weddingId;
}

async function computeAi(
  sender: SessionData,
  matchId: string,
  pairLabel: string,
): Promise<void> {
  if (SKIP_AI) {
    log('info', 'SKIP_AI=true — AI compute skipped');
    return;
  }

  try {
    const dpi = await api<{
      score: number;
      level: string;
      label: string;
    }>(`/api/v1/ai/divorce-indicator/${matchId}`, { cookie: sender.cookie });
    log(
      'ok',
      `DPI ${pairLabel}: score=${dpi.data.score} level=${dpi.data.level} label="${dpi.data.label}"`,
    );
  } catch (e) {
    log('warn', `DPI ${pairLabel} failed: ${(e as Error).message}`);
  }

  try {
    const fii = await api<{
      compatibility_score: number;
      label: string;
    }>(`/api/v1/ai/fii/compatibility/${matchId}`, { cookie: sender.cookie });
    log(
      'ok',
      `FII ${pairLabel}: score=${fii.data.compatibility_score} label="${fii.data.label}"`,
    );
  } catch (e) {
    log('warn', `FII ${pairLabel} failed: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  log('info', `API_URL = ${API_URL}`);
  log('info', `SEED_OTP = ${SEED_OTP}`);
  await confirmIfProd();

  const sessions: Partial<Record<'aarav' | 'priya' | 'anjali', SessionData>> =
    {};

  for (const profile of PROFILES) {
    const s = await seedProfile(profile);
    if (s) sessions[profile.key] = s;
  }

  // CRITICAL: signups + Aarav<->Priya match flow
  const aarav = sessions.aarav;
  const priya = sessions.priya;
  let matchId: string | null = null;

  if (aarav && priya) {
    try {
      matchId = await sendInterestAndAccept(aarav, priya);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ step: 'match:aarav-priya', error: msg });
      log('err', `match flow failed: ${msg}`);
    }
  } else {
    failures.push({
      step: 'match:aarav-priya',
      error: 'one of the sessions missing (signup failed)',
    });
  }

  if (matchId && aarav && priya) {
    try {
      await seedChat(matchId, aarav, priya);
    } catch (e) {
      log('warn', `chat seed failed: ${(e as Error).message}`);
    }
  }

  let weddingId: string | null = null;
  if (aarav) {
    try {
      weddingId = await seedWedding(aarav);
    } catch (e) {
      log('warn', `wedding seed failed: ${(e as Error).message}`);
    }
  }

  if (matchId && aarav) {
    await computeAi(aarav, matchId, 'Aarav↔Priya');
  }

  // Optional Anjali pair (need separate match flow)
  const anjali = sessions.anjali;
  if (aarav && anjali) {
    try {
      const m2 = await sendInterestAndAccept(aarav, anjali);
      if (m2) await computeAi(aarav, m2, 'Aarav↔Anjali');
    } catch (e) {
      log('warn', `anjali match flow failed: ${(e as Error).message}`);
    }
  }

  // ── Final report ─────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('SEED REPORT');
  console.log('═'.repeat(70));
  for (const key of Object.keys(sessions) as ('aarav' | 'priya' | 'anjali')[]) {
    const s = sessions[key]!;
    console.log(
      `  ${key.padEnd(8)} userId=${s.userId ?? '?'}  profileId=${s.profileId ?? '?'}`,
    );
  }
  console.log(`  matchId   = ${matchId ?? '(missing)'}`);
  console.log(`  weddingId = ${weddingId ?? '(missing)'}`);
  console.log(`\n  successes: ${successes.length}`);
  for (const ok of successes) console.log(`    ✓ ${ok}`);
  console.log(`  failures:  ${failures.length}`);
  for (const f of failures) console.log(`    ✗ ${f.step}: ${f.error}`);
  console.log('═'.repeat(70));

  const criticalOk =
    !!sessions.aarav && !!sessions.priya && !!matchId;
  if (criticalOk) {
    console.log('\nDemo data ready for May 16 demo');
    process.exit(0);
  } else {
    console.error('\nCritical steps failed — see failures above');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
