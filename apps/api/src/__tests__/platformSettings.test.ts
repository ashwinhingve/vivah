/**
 * Platform Settings — service + admin route tests.
 *
 * Mocks db (chainable proxy with FIFO queue), Better Auth, logger.
 * Verifies:
 *   - getPlatformSetting reads + caches; setPlatformSetting busts cache
 *   - isLGBTQMatchingEnabled returns the seeded boolean
 *   - PATCH requires ADMIN role
 *   - PATCH validates lgbtq_matching_enabled is boolean
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';

const { mockGetSession, dbState, makeChain, mockLoggerError, insertCalls } = vi.hoisted(() => {
  const dbState = { queue: [] as unknown[][] };
  const insertCalls: Array<{ table: string; values: unknown }> = [];
  const makeChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = {};
    const ret = () => p;
    for (const m of [
      'from','where','groupBy','orderBy','innerJoin','leftJoin','rightJoin',
      'limit','offset','having','set','returning','onConflictDoUpdate','values',
    ]) {
      p[m] = ret;
    }
    p.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(dbState.queue.shift() ?? []));
    return p;
  };
  return { mockGetSession: vi.fn(), dbState, makeChain, mockLoggerError: vi.fn(), insertCalls };
});

vi.mock('../auth/config.js', () => ({
  auth: {
    handler: vi.fn((_req: Request, res: Response) => { res.json({ success: true }); }),
    api: { getSession: mockGetSession },
  },
}));

vi.mock('better-auth/node', () => ({
  toNodeHandler: (a: { handler: (r: Request, s: Response) => void }) =>
    (req: Request, res: Response) => a.handler(req, res),
  fromNodeHeaders: vi.fn((h: Record<string, string>) => h),
}));

vi.mock('../auth/lastActive.js', () => ({ pingLastActive: vi.fn() }));

vi.mock('../lib/db.js', () => ({
  db: {
    select: () => makeChain(),
    insert: (table: { _: { name: string } } | unknown) => {
      const chain = makeChain();
      const origValues = chain.values;
      chain.values = (vals: unknown) => {
        insertCalls.push({ table: String((table as { _?: { name?: string } })._?.name ?? 'unknown'), values: vals });
        return origValues();
      };
      return chain;
    },
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { platformSettingsRouter } from '../admin/platformSettings.router.js';
import {
  getPlatformSetting,
  isLGBTQMatchingEnabled,
  setPlatformSetting,
  __clearPlatformSettingsCache,
} from '../services/platformSettingsService.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', platformSettingsRouter);
  return app;
}

const ADMIN_USER = { id: 'admin_a', name: 'Admin', email: 'a@x', role: 'ADMIN', status: 'ACTIVE' };
const REGULAR_USER = { id: 'reg_z', name: 'Reg', email: 'r@x', role: 'INDIVIDUAL', status: 'ACTIVE' };

beforeEach(() => {
  dbState.queue = [];
  insertCalls.length = 0;
  mockGetSession.mockReset();
  mockLoggerError.mockReset();
  __clearPlatformSettingsCache();
});

describe('platformSettingsService', () => {
  it('getPlatformSetting returns the seeded value and caches subsequent reads', async () => {
    // First call hits db; second call must NOT consume from the queue.
    dbState.queue = [[{ value: true }]];
    const v1 = await getPlatformSetting('lgbtq_matching_enabled');
    const v2 = await getPlatformSetting('lgbtq_matching_enabled');
    expect(v1).toBe(true);
    expect(v2).toBe(true);
    // queue should still be empty after both reads (second hit cache)
    expect(dbState.queue.length).toBe(0);
  });

  it('isLGBTQMatchingEnabled returns false when value is absent or non-boolean', async () => {
    dbState.queue = [[]]; // empty rows
    const v = await isLGBTQMatchingEnabled();
    expect(v).toBe(false);
  });

  it('setPlatformSetting invalidates the cache so the next read goes to db', async () => {
    dbState.queue = [[{ value: false }]];
    expect(await isLGBTQMatchingEnabled()).toBe(false);
    // setPlatformSetting performs an upsert (insert.onConflictDoUpdate)
    dbState.queue = [[]]; // upsert returns nothing
    await setPlatformSetting('lgbtq_matching_enabled', true, ADMIN_USER.id);
    // Next read must re-hit db; queue gets a true value.
    dbState.queue = [[{ value: true }]];
    expect(await isLGBTQMatchingEnabled()).toBe(true);
  });
});

describe('PATCH /api/v1/admin/platform-settings/:key', () => {
  it('returns 401 with no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await request(buildApp())
      .patch('/api/v1/admin/platform-settings/lgbtq_matching_enabled')
      .send({ value: true });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not ADMIN', async () => {
    mockGetSession.mockResolvedValueOnce({ user: REGULAR_USER, session: {} });
    const res = await request(buildApp())
      .patch('/api/v1/admin/platform-settings/lgbtq_matching_enabled')
      .send({ value: true });
    expect(res.status).toBe(403);
  });

  it('rejects a non-boolean lgbtq_matching_enabled value with 400', async () => {
    mockGetSession.mockResolvedValueOnce({ user: ADMIN_USER, session: {} });
    const res = await request(buildApp())
      .patch('/api/v1/admin/platform-settings/lgbtq_matching_enabled')
      .send({ value: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/boolean/i);
  });
});
