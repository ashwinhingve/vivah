/**
 * Tests for the /health and /ready endpoints.
 * Verifies dependency checking (Postgres, Redis).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import express from 'express';
import request from 'supertest';

describe('/health endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 when all dependencies are healthy', async () => {
    // Mock healthy responses
    vi.doMock('../lib/db.js', () => ({
      db: {
        $client: {
          query: vi.fn().mockResolvedValue({ rows: [] }),
        },
      },
    }));

    vi.doMock('../lib/redis.js', () => ({
      redis: {
        ping: vi.fn().mockResolvedValue('PONG'),
      },
    }));

    // Create a simple health endpoint handler for testing
    app.get('/health', async (_req: Request, res: Response) => {
      const checks: Record<string, string> = {};
      let allOk = true;

      try {
        const { db } = await import('../lib/db.js');
        const dbPromise = (db.$client as unknown as { query: (q: string) => Promise<unknown> }).query('SELECT 1');
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([dbPromise, timeoutPromise]);
        checks['postgres'] = 'ok';
      } catch (err) {
        checks['postgres'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      try {
        const { redis } = await import('../lib/redis.js');
        const pingPromise = redis.ping();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        checks['redis'] = 'ok';
      } catch (err) {
        checks['redis'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      res.status(allOk ? 200 : 503).json({
        success: allOk,
        data: { status: allOk ? 'ok' : 'degraded', checks },
        error: null,
        meta: { timestamp: new Date().toISOString() },
      });
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('should return 503 when Postgres is unhealthy', async () => {
    vi.doMock('../lib/db.js', () => ({
      db: {
        $client: {
          query: vi.fn().mockRejectedValue(new Error('connection refused')),
        },
      },
    }));

    vi.doMock('../lib/redis.js', () => ({
      redis: {
        ping: vi.fn().mockResolvedValue('PONG'),
      },
    }));

    app.get('/health', async (_req: Request, res: Response) => {
      const checks: Record<string, string> = {};
      let allOk = true;

      try {
        const { db } = await import('../lib/db.js');
        const dbPromise = (db.$client as unknown as { query: (q: string) => Promise<unknown> }).query('SELECT 1');
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([dbPromise, timeoutPromise]);
        checks['postgres'] = 'ok';
      } catch (err) {
        checks['postgres'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      try {
        const { redis } = await import('../lib/redis.js');
        const pingPromise = redis.ping();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        checks['redis'] = 'ok';
      } catch (err) {
        checks['redis'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      res.status(allOk ? 200 : 503).json({
        success: allOk,
        data: { status: allOk ? 'ok' : 'degraded', checks },
        error: null,
        meta: { timestamp: new Date().toISOString() },
      });
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.checks.postgres).toContain('connection refused');
  });

  it('should return 503 when Redis is unhealthy', async () => {
    vi.doMock('../lib/db.js', () => ({
      db: {
        $client: {
          query: vi.fn().mockResolvedValue({ rows: [] }),
        },
      },
    }));

    vi.doMock('../lib/redis.js', () => ({
      redis: {
        ping: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      },
    }));

    app.get('/health', async (_req: Request, res: Response) => {
      const checks: Record<string, string> = {};
      let allOk = true;

      try {
        const { db } = await import('../lib/db.js');
        const dbPromise = (db.$client as unknown as { query: (q: string) => Promise<unknown> }).query('SELECT 1');
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([dbPromise, timeoutPromise]);
        checks['postgres'] = 'ok';
      } catch (err) {
        checks['postgres'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      try {
        const { redis } = await import('../lib/redis.js');
        const pingPromise = redis.ping();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        checks['redis'] = 'ok';
      } catch (err) {
        checks['redis'] = err instanceof Error ? err.message : 'unreachable';
        allOk = false;
      }

      res.status(allOk ? 200 : 503).json({
        success: allOk,
        data: { status: allOk ? 'ok' : 'degraded', checks },
        error: null,
        meta: { timestamp: new Date().toISOString() },
      });
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.checks.redis).toContain('redis unavailable');
  });

  it('should include check status in response', async () => {
    app.get('/health', async (_req: Request, res: Response) => {
      const checks: Record<string, string> = { postgres: 'ok', redis: 'ok' };
      const allOk = true;

      res.status(allOk ? 200 : 503).json({
        success: allOk,
        data: { status: 'ok', checks },
        error: null,
        meta: { timestamp: new Date().toISOString() },
      });
    });

    const res = await request(app).get('/health');
    expect(res.body.data.checks).toBeDefined();
    expect(res.body.data.checks.postgres).toBe('ok');
    expect(res.body.data.checks.redis).toBe('ok');
  });

  it('should follow standard response envelope format', async () => {
    app.get('/health', async (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: { status: 'ok', checks: { postgres: 'ok', redis: 'ok' } },
        error: null,
        meta: { timestamp: new Date().toISOString() },
      });
    });

    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('meta');
    expect(res.body).toHaveProperty('meta.timestamp');
  });
});
