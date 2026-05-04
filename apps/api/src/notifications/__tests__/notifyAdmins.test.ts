/**
 * notifyAdmins fan-out — replaces the broken `'admin'` sentinel pattern.
 * Verifies that one notification job is enqueued per ADMIN-role user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queueAdd = vi.fn().mockResolvedValue(undefined);

vi.mock('../../infrastructure/redis/queues.js', () => ({
  notificationsQueue: { add: queueAdd },
}));

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn(() => ({ type: 'eq' })),
  and: vi.fn(() => ({ type: 'and' })),
}));

vi.mock('@smartshaadi/db', () => ({
  user:                    {},
  notifications:           {},
  notificationPreferences: {},
  deviceTokens:            {},
  profiles:                {},
}));

let adminRows: Array<{ id: string }> = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => Promise.resolve(adminRows)),
      })),
    })),
  },
}));

vi.mock('../providers/fcm.js',   () => ({ sendPush:  vi.fn() }));
vi.mock('../providers/ses.js',   () => ({ sendEmail: vi.fn() }));
vi.mock('../providers/msg91.js', () => ({ sendSms:   vi.fn() }));

describe('notifyAdmins', () => {
  beforeEach(() => {
    queueAdd.mockClear();
  });

  it('enqueues one job per admin user', async () => {
    adminRows = [{ id: 'admin-1' }, { id: 'admin-2' }, { id: 'admin-3' }];
    const { notifyAdmins } = await import('../service.js');

    const result = await notifyAdmins('DISPUTE_NEEDS_REVIEW', { bookingId: 'b-1' });

    expect(result.enqueued).toBe(3);
    expect(queueAdd).toHaveBeenCalledTimes(3);
    expect(queueAdd).toHaveBeenCalledWith('DISPUTE_NEEDS_REVIEW', expect.objectContaining({
      type:    'DISPUTE_NEEDS_REVIEW',
      userId:  'admin-1',
      payload: { bookingId: 'b-1' },
    }));
    expect(queueAdd).toHaveBeenCalledWith('DISPUTE_NEEDS_REVIEW', expect.objectContaining({
      userId: 'admin-2',
    }));
    expect(queueAdd).toHaveBeenCalledWith('DISPUTE_NEEDS_REVIEW', expect.objectContaining({
      userId: 'admin-3',
    }));
  });

  it('logs warning and returns enqueued=0 when no admins exist', async () => {
    adminRows = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { notifyAdmins } = await import('../service.js');

    const result = await notifyAdmins('DISPUTE_NEEDS_REVIEW', { bookingId: 'b-2' });

    expect(result.enqueued).toBe(0);
    expect(queueAdd).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no ADMIN users'),
      expect.objectContaining({ type: 'DISPUTE_NEEDS_REVIEW' }),
    );
    warn.mockRestore();
  });
});
