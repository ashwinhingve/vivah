/**
 * weddingCompletionJob — scheduling helper tests.
 * Redis/BullMQ and DB are fully mocked; no live connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const add = vi.fn(async () => undefined);
const remove = vi.fn(async () => undefined);

vi.mock('../../infrastructure/redis/queues.js', () => ({
  connection: {},
  DEFAULT_JOB_OPTS: { attempts: 5 },
  weddingCompletionQueue: { add, remove },
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

vi.mock('../../lib/db.js', () => ({ db: {} }));

vi.mock('@smartshaadi/db', () => ({ weddings: { id: {}, status: {}, deletedAt: {} } }));

vi.mock('drizzle-orm', () => {
  const stub = (..._a: unknown[]) => ({ _sql: true });
  return { and: stub, eq: stub, isNull: stub, inArray: stub };
});

describe('scheduleWeddingCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues a delayed job with a deterministic jobId fired the day after the wedding', async () => {
    const { scheduleWeddingCompletion } = await import('../weddingCompletionJob.js');

    const future = new Date();
    future.setDate(future.getDate() + 10);
    const weddingDate = future.toISOString().slice(0, 10);

    await scheduleWeddingCompletion('wedding-xyz', weddingDate);

    // Stale job removed first, then re-added.
    expect(remove).toHaveBeenCalledWith('wedding-complete-wedding-xyz');
    expect(add).toHaveBeenCalledTimes(1);

    const [name, data, opts] = add.mock.calls[0] as unknown as [
      string,
      { weddingId: string; weddingDate: string },
      { delay: number; jobId: string },
    ];
    expect(name).toBe('complete-wedding');
    expect(data.weddingId).toBe('wedding-xyz');
    expect(opts.jobId).toBe('wedding-complete-wedding-xyz');
    // ~11 days out (10 + 1), comfortably positive.
    expect(opts.delay).toBeGreaterThan(9 * 24 * 60 * 60 * 1000);
  });

  it('cancelWeddingCompletion removes the pending job by id', async () => {
    const { cancelWeddingCompletion } = await import('../weddingCompletionJob.js');
    await cancelWeddingCompletion('wedding-abc');
    expect(remove).toHaveBeenCalledWith('wedding-complete-wedding-abc');
  });
});
